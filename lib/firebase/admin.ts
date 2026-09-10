import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { isAdminSdkConfigured, readEnv } from "@/lib/env.server";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

let adminApp: App | null = null;

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
      hasProjectId: Boolean(readEnv("FIREBASE_ADMIN_PROJECT_ID")),
      hasClientEmail: Boolean(readEnv("FIREBASE_ADMIN_CLIENT_EMAIL")),
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
  if (getApps().length > 0) {
    adminApp = getApps()[0]!;
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
    adminApp = initializeApp({
      credential: cert({
        projectId: readEnv("FIREBASE_ADMIN_PROJECT_ID"),
        clientEmail: readEnv("FIREBASE_ADMIN_CLIENT_EMAIL"),
        privateKey,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    logger.error("Firebase Admin failed to initialize", { message });
    throw new AppError(
      "CONFIG_MISSING",
      "Firebase Admin credentials are invalid. Check FIREBASE_ADMIN_PRIVATE_KEY formatting in Vercel Production.",
      503,
    );
  }
  return adminApp;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

export function tryGetAdminDb() {
  if (!isAdminSdkConfigured()) return null;
  try {
    return getAdminDb();
  } catch {
    return null;
  }
}
