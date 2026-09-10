import type { App } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import {
  getFirebaseAdminClientEmail,
  getFirebaseAdminProjectId,
  isAdminSdkConfigured,
  readEnv,
} from "@/lib/env.server";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

type AdminNamespace = {
  apps: Array<App | null>;
  initializeApp: (options: {
    credential: unknown;
    projectId?: string;
  }) => App;
  credential: {
    cert: (serviceAccount: { projectId: string; clientEmail: string; privateKey: string }) => unknown;
  };
  auth: (app?: App) => Auth;
  firestore: (app?: App) => Firestore;
};

let adminApp: App | null = null;
let adminNs: AdminNamespace | null = null;

function loadAdminNamespace(): AdminNamespace {
  if (adminNs) return adminNs;
  try {
    // Use the CJS main entry. Subpath imports (firebase-admin/app) crash Vercel
    // functions at module-evaluation time with an empty HTTP 500.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loaded = require("firebase-admin") as AdminNamespace & { default?: AdminNamespace };
    adminNs = loaded.credential ? loaded : loaded.default!;
    return adminNs;
  } catch (error) {
    logger.error("firebase-admin module failed to load", {
      name: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : "unknown",
      node: process.versions.node,
    });
    throw new AppError(
      "FIREBASE_ERROR",
      "Authentication service temporarily unavailable",
      500,
    );
  }
}

function decodeMaybeBase64(value: string) {
  const compact = value.replace(/\s+/g, "");
  if (!compact || compact.includes("BEGIN")) return value;
  if (!/^[A-Za-z0-9+/=]+$/.test(compact)) return value;
  try {
    const decoded = Buffer.from(compact, "base64").toString("utf8");
    return decoded.includes("BEGIN PRIVATE KEY") ? decoded : value;
  } catch {
    return value;
  }
}

function getPrivateKey() {
  const raw =
    readEnv("FIREBASE_ADMIN_PRIVATE_KEY") ||
    readEnv("FIREBASE_PRIVATE_KEY") ||
    (readEnv("FIREBASE_ADMIN_PRIVATE_KEY_BASE64")
      ? Buffer.from(readEnv("FIREBASE_ADMIN_PRIVATE_KEY_BASE64"), "base64").toString("utf8")
      : "");
  let key = decodeMaybeBase64(raw);
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n").replace(/\r/g, "").trim();
}

export function getAdminApp() {
  if (!isAdminSdkConfigured()) {
    logger.error("Firebase Admin is not configured", {
      hasProjectId: Boolean(getFirebaseAdminProjectId()),
      hasClientEmail: Boolean(getFirebaseAdminClientEmail()),
      hasPem: Boolean(readEnv("FIREBASE_ADMIN_PRIVATE_KEY") || readEnv("FIREBASE_PRIVATE_KEY")),
      hasPemBase64: Boolean(readEnv("FIREBASE_ADMIN_PRIVATE_KEY_BASE64")),
    });
    throw new AppError(
      "CONFIG_MISSING",
      "Firebase Admin is not configured. Add FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY in Vercel Production environment variables.",
      503,
    );
  }
  if (adminApp) return adminApp;
  const admin = loadAdminNamespace();
  if (admin.apps.length > 0) {
    adminApp = admin.apps[0] as App;
    return adminApp;
  }
  const privateKey = getPrivateKey();
  if (!privateKey.includes("BEGIN PRIVATE KEY")) {
    throw new AppError(
      "CONFIG_MISSING",
      "FIREBASE_ADMIN_PRIVATE_KEY is present but is not a valid PEM key. In Vercel, paste the full key as a single line using \\n for newlines.",
      503,
    );
  }
  try {
    adminApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: getFirebaseAdminProjectId(),
        clientEmail: getFirebaseAdminClientEmail(),
        privateKey,
      }),
      projectId: getFirebaseAdminProjectId(),
    }) as App;
    logger.info("Firebase Admin initialized", {
      projectId: getFirebaseAdminProjectId(),
      node: process.versions.node,
    });
  } catch (error) {
    logger.error("Firebase Admin failed to initialize", {
      name: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : "unknown",
    });
    throw new AppError(
      "CONFIG_MISSING",
      "Firebase Admin credentials are invalid. Check FIREBASE_ADMIN_PRIVATE_KEY formatting in Vercel Production.",
      503,
    );
  }
  return adminApp;
}

export function getAdminAuth(): Auth {
  getAdminApp();
  return loadAdminNamespace().auth();
}

export function getAdminDb(): Firestore {
  getAdminApp();
  return loadAdminNamespace().firestore();
}

export function tryGetAdminDb() {
  if (!isAdminSdkConfigured()) return null;
  try {
    return getAdminDb();
  } catch {
    return null;
  }
}
