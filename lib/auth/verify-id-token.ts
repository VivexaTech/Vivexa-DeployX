import { createPublicKey, verify } from "crypto";
import { AppError, isAppError } from "@/lib/errors";
import { getAppUrl } from "@/lib/env";

export type VerifiedFirebaseUser = {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
};

const CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const CLOCK_SKEW_MS = 60_000;

type GoogleCertCache = {
  certs: Record<string, string>;
  expiresAt: number;
};

let certCache: GoogleCertCache | null = null;

function getFirebaseProjectId() {
  return (
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    ""
  ).trim();
}

function getFirebaseWebApiKey() {
  return (process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "").trim();
}

function decodeJwtPart(part: string) {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
}

async function getGoogleCerts() {
  if (certCache && certCache.expiresAt > Date.now()) return certCache.certs;
  const response = await fetch(CERTS_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new AppError("EXTERNAL_UNAVAILABLE", "Could not verify Google sign-in. Try again.", 503);
  }
  const certs = (await response.json()) as Record<string, string>;
  const cacheControl = response.headers.get("cache-control") ?? "";
  const maxAge = Number(/max-age=(\d+)/i.exec(cacheControl)?.[1] ?? "3600");
  certCache = {
    certs,
    expiresAt: Date.now() + Math.max(60, maxAge) * 1000,
  };
  return certs;
}

function sessionFromPayload(payload: Record<string, unknown>): VerifiedFirebaseUser {
  const uid = typeof payload.user_id === "string" ? payload.user_id : typeof payload.sub === "string" ? payload.sub : "";
  if (!uid) {
    throw new AppError("UNAUTHENTICATED", "Google sign-in expired. Please try again.", 401);
  }
  return {
    uid,
    email: typeof payload.email === "string" ? payload.email : null,
    name: typeof payload.name === "string" ? payload.name : null,
    picture: typeof payload.picture === "string" ? payload.picture : null,
  };
}

async function verifyWithGoogleCerts(idToken: string, projectId: string): Promise<VerifiedFirebaseUser> {
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    throw new AppError("UNAUTHENTICATED", "Google sign-in expired. Please try again.", 401);
  }
  const [headerPart, payloadPart, signaturePart] = parts;
  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = decodeJwtPart(headerPart);
    payload = decodeJwtPart(payloadPart);
  } catch {
    throw new AppError("UNAUTHENTICATED", "Google sign-in expired. Please try again.", 401);
  }
  const kid = typeof header.kid === "string" ? header.kid : "";
  if (!kid || header.alg !== "RS256") {
    throw new AppError("UNAUTHENTICATED", "Google sign-in expired. Please try again.", 401);
  }
  let certs = await getGoogleCerts();
  if (!certs[kid]) {
    certCache = null;
    certs = await getGoogleCerts();
  }
  const certificate = certs[kid];
  if (!certificate) {
    throw new AppError("UNAUTHENTICATED", "Google sign-in expired. Please try again.", 401);
  }
  let valid = false;
  try {
    valid = verify(
      "sha256",
      Buffer.from(`${headerPart}.${payloadPart}`),
      createPublicKey(certificate),
      Buffer.from(signaturePart, "base64url"),
    );
  } catch {
    valid = false;
  }
  if (!valid) {
    throw new AppError("UNAUTHENTICATED", "Google sign-in expired. Please try again.", 401);
  }
  const now = Date.now();
  const exp = typeof payload.exp === "number" ? payload.exp * 1000 : 0;
  const aud = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;
  const iss = payload.iss;
  if (!exp || exp + CLOCK_SKEW_MS < now) {
    throw new AppError("UNAUTHENTICATED", "Google sign-in expired. Please try again.", 401);
  }
  if (aud !== projectId || iss !== `https://securetoken.google.com/${projectId}`) {
    throw new AppError("UNAUTHENTICATED", "Google sign-in expired. Please try again.", 401);
  }
  return sessionFromPayload(payload);
}

async function verifyWithIdentityToolkit(idToken: string): Promise<VerifiedFirebaseUser> {
  const apiKey = getFirebaseWebApiKey();
  if (!apiKey) {
    throw new AppError("CONFIG_MISSING", "Firebase client API key is not configured.", 503);
  }
  const appUrl = getAppUrl();
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: appUrl,
        Referer: `${appUrl}/`,
      },
      body: JSON.stringify({ idToken }),
    },
  );
  const data = (await response.json()) as {
    users?: Array<{ localId?: string; email?: string; displayName?: string; photoUrl?: string }>;
    error?: { message?: string };
  };
  const user = data.users?.[0];
  if (!response.ok || !user?.localId) {
    throw new AppError("UNAUTHENTICATED", "Google sign-in expired. Please try again.", 401);
  }
  return {
    uid: user.localId,
    email: user.email ?? null,
    name: user.displayName ?? null,
    picture: user.photoUrl ?? null,
  };
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser> {
  const projectId = getFirebaseProjectId();
  if (!projectId) {
    throw new AppError(
      "CONFIG_MISSING",
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing in Vercel Production environment variables.",
      503,
    );
  }
  try {
    return await verifyWithGoogleCerts(idToken, projectId);
  } catch (error) {
    if (isAppError(error) && error.code === "UNAUTHENTICATED") throw error;
    try {
      return await verifyWithIdentityToolkit(idToken);
    } catch (fallbackError) {
      if (isAppError(fallbackError)) throw fallbackError;
      throw isAppError(error)
        ? error
        : new AppError("EXTERNAL_UNAVAILABLE", "Could not verify Google sign-in. Try again.", 503);
    }
  }
}
