import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto";
import { readEnv } from "@/lib/env.server";
import { AppError } from "@/lib/errors";

function getAppSecret() {
  return (
    readEnv("APP_ENCRYPTION_KEY") ||
    readEnv("CRON_SECRET") ||
    readEnv("SESSION_SECRET") ||
    [process.env.VERCEL_PROJECT_ID, process.env.NEXT_PUBLIC_FIREBASE_APP_ID].filter(Boolean).join(":") ||
    (process.env.VERCEL === "1" ? "" : "deployx-dev")
  );
}

export function tokenStoreReady() {
  return Boolean(getAppSecret());
}

function getKey() {
  const secret = getAppSecret();
  if (!secret) {
    throw new AppError(
      "CONFIG_MISSING",
      "APP_ENCRYPTION_KEY is required to store GitHub tokens securely.",
      503,
    );
  }
  return Buffer.from(secret.padEnd(32, "0").slice(0, 32));
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptSecret(payload: string) {
  const [iv, tag, data] = payload.split(".");
  if (!iv || !tag || !data) {
    throw new AppError("INTERNAL", "Stored credential is invalid.", 500);
  }
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(data, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function signValue(value: string) {
  const secret = getAppSecret() || "deployx-dev";
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function verifySignedValue(value: string, signature: string) {
  const expected = signValue(value);
  return expected === signature;
}
