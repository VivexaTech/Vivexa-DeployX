import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { isAdminSdkConfigured, readEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

let adminApp: App | null = null;

function getPrivateKey() {
  let key = readEnv("FIREBASE_ADMIN_PRIVATE_KEY");
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n");
}

export function getAdminApp() {
  if (!isAdminSdkConfigured()) {
    throw new AppError(
      "CONFIG_MISSING",
      "Firebase Admin is not configured. Add FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY.",
      503,
    );
  }
  if (adminApp) return adminApp;
  if (getApps().length > 0) {
    adminApp = getApps()[0]!;
    return adminApp;
  }
  adminApp = initializeApp({
    credential: cert({
      projectId: readEnv("FIREBASE_ADMIN_PROJECT_ID"),
      clientEmail: readEnv("FIREBASE_ADMIN_CLIENT_EMAIL"),
      privateKey: getPrivateKey(),
    }),
  });
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
  return getAdminDb();
}
