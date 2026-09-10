import { AppError } from "@/lib/errors";

export function readEnv(name: string, fallback = "") {
  return (process.env[name] ?? fallback).trim();
}

function publicEnv(value: string | undefined) {
  return (value ?? "").trim();
}

function withProtocol(url: string) {
  const trimmed = url.replace(/\/$/, "");
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("localhost") || trimmed.startsWith("127.0.0.1")) {
    return `http://${trimmed}`;
  }
  return `https://${trimmed}`;
}

export function getAppUrl() {
  const raw =
    readEnv("APP_URL") ||
    publicEnv(process.env.NEXT_PUBLIC_APP_URL) ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return withProtocol(raw);
}

export function getMainDomain() {
  return readEnv("MAIN_DOMAIN") || publicEnv(process.env.NEXT_PUBLIC_MAIN_DOMAIN) || "vivexatech.in";
}

export function getPublicFirebaseConfig() {
  return {
    apiKey: publicEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain: publicEnv(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
    projectId: publicEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    storageBucket: publicEnv(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: publicEnv(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
    appId: publicEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  };
}

export function isPublicFirebaseConfigured() {
  const config = getPublicFirebaseConfig();
  return Boolean(config.apiKey && config.projectId && config.appId);
}

export function isAdminSdkConfigured() {
  return Boolean(
    readEnv("FIREBASE_ADMIN_PROJECT_ID") &&
      readEnv("FIREBASE_ADMIN_CLIENT_EMAIL") &&
      readEnv("FIREBASE_ADMIN_PRIVATE_KEY"),
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

export function getRazorpayPublicKey() {
  return publicEnv(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) || readEnv("RAZORPAY_KEY_ID");
}
