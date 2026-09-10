import type { App } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import {
  getFirebaseAdminClientEmail,
  getFirebaseAdminProjectId,
  isAdminSdkConfigured,
  readEnv,
} from "@/lib/env.server";
import { AppError, isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

type AppModule = {
  getApps: () => App[];
  initializeApp: (options: { credential: unknown; projectId?: string }) => App;
  cert: (serviceAccount: { projectId: string; clientEmail: string; privateKey: string }) => unknown;
};

type AuthModule = {
  getAuth: (app?: App) => Auth;
};

type FirestoreModule = {
  getFirestore: (app?: App) => Firestore;
};

let adminApp: App | null = null;
let appMod: AppModule | null = null;

function resolveModule<T extends object>(loaded: T & { default?: T }, method: keyof T): T {
  if (loaded && typeof loaded[method] === "function") return loaded;
  if (loaded?.default && typeof loaded.default[method] === "function") return loaded.default;
  throw new AppError("FIREBASE_ERROR", "Authentication service temporarily unavailable", 500);
}

function loadAppModule(): AppModule {
  if (appMod) return appMod;
  try {
    // Lazy CJS require of the modular entry. Static ESM `import "firebase-admin/app"`
    // crashes Vercel functions at module-evaluation time (HTTP 500, empty body).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loaded = require("firebase-admin/app") as AppModule & { default?: AppModule };
    appMod = resolveModule(loaded, "initializeApp");
    return appMod;
  } catch (error) {
    if (isAppError(error)) throw error;
    logger.error("firebase-admin/app failed to load", {
      name: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : "unknown",
      node: process.versions.node,
    });
    throw new AppError("FIREBASE_ERROR", "Authentication service temporarily unavailable", 500);
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
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
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
  const admin = loadAppModule();
  const existing = admin.getApps();
  if (existing.length > 0) {
    adminApp = existing[0] as App;
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
      credential: admin.cert({
        projectId: getFirebaseAdminProjectId(),
        clientEmail: getFirebaseAdminClientEmail(),
        privateKey,
      }),
      projectId: getFirebaseAdminProjectId(),
    });
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
  const app = getAdminApp();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loaded = require("firebase-admin/auth") as AuthModule & { default?: AuthModule };
    return resolveModule(loaded, "getAuth").getAuth(app);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw new AppError("FIREBASE_ERROR", "Authentication service temporarily unavailable", 500);
  }
}

export function getAdminDb(): Firestore {
  const app = getAdminApp();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loaded = require("firebase-admin/firestore") as FirestoreModule & { default?: FirestoreModule };
    return resolveModule(loaded, "getFirestore").getFirestore(app);
  } catch (error) {
    if (isAppError(error)) throw error;
    throw new AppError("FIREBASE_ERROR", "Authentication service temporarily unavailable", 500);
  }
}

export function tryGetAdminDb() {
  if (!isAdminSdkConfigured()) return null;
  try {
    return getAdminDb();
  } catch (error) {
    logger.error("Firebase Admin database unavailable", {
      name: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

export function probeAdminSdk() {
  try {
    getAdminApp();
    return { ready: true as const };
  } catch (error) {
    return {
      ready: false as const,
      code: error instanceof AppError ? error.code : "INTERNAL",
    };
  }
}
