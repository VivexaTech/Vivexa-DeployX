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

function isUsableAppUrl(url: string) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    if (host === "localhost" || host === "127.0.0.1") return false;
    if (host.endsWith(".vercel.app")) return false;
    return true;
  } catch {
    return false;
  }
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
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

export function getAppUrl() {
  const onVercel = process.env.VERCEL === "1";
  if (!onVercel && process.env.NODE_ENV !== "production") {
    const port = publicEnv(process.env.PORT) || "3000";
    return `http://localhost:${port}`;
  }
  const raw = publicEnv(process.env.APP_URL) || publicEnv(process.env.NEXT_PUBLIC_APP_URL);
  const url = withProtocol(raw);
  if (isUsableAppUrl(url)) return url;
  if (onVercel || process.env.NODE_ENV === "production") return "https://deployx.vivexatech.in";
  return url || "http://localhost:3000";
}

export function getMainDomain() {
  return publicEnv(process.env.MAIN_DOMAIN) || publicEnv(process.env.NEXT_PUBLIC_MAIN_DOMAIN) || "vivexatech.in";
}

export function getRazorpayPublicKey() {
  return publicEnv(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) || publicEnv(process.env.RAZORPAY_KEY_ID);
}
