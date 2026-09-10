import { PRODUCTION_APP_URL } from "@/config/constants";
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

export { getMainDomain, getRazorpayPublicKey } from "@/lib/env";

function withProtocol(url: string) {
  const trimmed = url.replace(/\/$/, "").trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(localhost|127\.0\.0\.1)/i.test(trimmed)) return `http://${trimmed}`;
  return `https://${trimmed}`;
}

function hostnameOf(url: string) {
  try {
    return new URL(withProtocol(url)).hostname;
  } catch {
    return "";
  }
}

function isLocalhostHost(host: string) {
  const hostname = host.replace(/:\d+$/, "").toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function isUsableAppUrl(url: string) {
  if (!url) return false;
  const host = hostnameOf(url);
  if (!host || isLocalhostHost(host)) return false;
  if (host.endsWith(".vercel.app")) return false;
  return true;
}

export function getAppUrl() {
  const onVercel = readEnv("VERCEL") === "1";
  const nodeEnv = readEnv("NODE_ENV") || process.env.NODE_ENV || "";
  if (!onVercel && nodeEnv !== "production") {
    const port = readEnv("PORT") || "3000";
    return `http://localhost:${port}`;
  }
  const candidates = [readEnv("APP_URL"), readEnv("NEXT_PUBLIC_APP_URL")];
  for (const raw of candidates) {
    const url = withProtocol(raw);
    if (isUsableAppUrl(url)) return url;
  }
  if (onVercel || nodeEnv === "production") return PRODUCTION_APP_URL;
  return "http://localhost:3000";
}

export function getRequestOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? "";
  const hostHeader = request.headers.get("host")?.split(",")[0]?.trim() ?? "";
  const host = forwardedHost || hostHeader;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "";
  const isLocal = isLocalhostHost(host);

  let proto = forwardedProto;
  if (!proto) {
    try {
      proto = new URL(request.url).protocol.replace(":", "");
    } catch {
      proto = "";
    }
  }
  if (isLocal) proto = "http";
  else if (readEnv("VERCEL") === "1") proto = "https";
  else if (!proto) proto = "https";

  if (!host) return getAppUrl();
  if (!isLocal && host.toLowerCase().endsWith(".vercel.app")) return getAppUrl();
  return `${proto}://${host}`.replace(/\/$/, "");
}
