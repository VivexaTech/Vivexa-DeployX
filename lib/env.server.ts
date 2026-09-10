import { AppError } from "@/lib/errors";

const serverEnv = {
  PORT: process.env.PORT,
  APP_URL: process.env.APP_URL,
  MAIN_DOMAIN: process.env.MAIN_DOMAIN,
  APP_ENCRYPTION_KEY: process.env.APP_ENCRYPTION_KEY,
  CRON_SECRET: process.env.CRON_SECRET,
  ADMIN_UIDS: process.env.ADMIN_UIDS,
  FIREBASE_ADMIN_PROJECT_ID: process.env.FIREBASE_ADMIN_PROJECT_ID,
  FIREBASE_ADMIN_CLIENT_EMAIL: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  FIREBASE_ADMIN_PRIVATE_KEY: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET,
  VERCEL_TOKEN: process.env.VERCEL_TOKEN,
  VERCEL_TEAM_ID: process.env.VERCEL_TEAM_ID,
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  RESEND_FROM_NAME: process.env.RESEND_FROM_NAME,
} as const;

type ServerEnvName = keyof typeof serverEnv;

function trimEnv(value: string | undefined, fallback = "") {
  return (value ?? "").trim() || fallback;
}

export function readEnv(name: string, fallback = "") {
  if (name in serverEnv) {
    return trimEnv(serverEnv[name as ServerEnvName], fallback);
  }
  return trimEnv(process.env[name], fallback);
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

export { getAppUrl, getMainDomain, getRazorpayPublicKey } from "@/lib/env";
