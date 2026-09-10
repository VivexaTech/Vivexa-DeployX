import { AppError } from "@/lib/errors";

function readProcessEnv(name: string) {
  // Dynamic lookup so Vercel injects secrets at runtime instead of baking them
  // into the server bundle (which breaks PEM private keys).
  return process.env[name];
}

export function readEnv(name: string, fallback = "") {
  const value = readProcessEnv(name);
  if (typeof value !== "string") return fallback;
  return value.trim() || fallback;
}

function firstEnv(...names: string[]) {
  for (const name of names) {
    const value = readEnv(name);
    if (value) return value;
  }
  return "";
}

export function getFirebaseAdminProjectId() {
  return firstEnv(
    "FIREBASE_ADMIN_PROJECT_ID",
    "FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  );
}

export function getFirebaseAdminClientEmail() {
  return firstEnv("FIREBASE_ADMIN_CLIENT_EMAIL", "FIREBASE_CLIENT_EMAIL");
}

export function isAdminSdkConfigured() {
  return Boolean(
    getFirebaseAdminProjectId() &&
      getFirebaseAdminClientEmail() &&
      (readEnv("FIREBASE_ADMIN_PRIVATE_KEY") ||
        readEnv("FIREBASE_PRIVATE_KEY") ||
        readEnv("FIREBASE_ADMIN_PRIVATE_KEY_BASE64")),
  );
}

export function getAdminUids() {
  return readEnv("ADMIN_UIDS")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function requireServerEnv(keys: string[]) {
  const missing = keys.filter((key) => !readEnv(key));
  if (missing.length > 0) {
    throw new AppError(
      "CONFIG_MISSING",
      `This feature is not configured yet. Missing: ${missing.join(", ")}`,
      503,
      { missing },
    );
  }
}

export { getAppUrl, getMainDomain, getRazorpayPublicKey } from "@/lib/env";
