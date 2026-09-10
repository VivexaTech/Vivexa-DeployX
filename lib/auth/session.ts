import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS } from "@/config/constants";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firebase/collections";
import { readEnv } from "@/lib/env.server";
import { logger } from "@/lib/logger";
import { nowIso } from "@/lib/utils";
import { AppError } from "@/lib/errors";
import type { SubscriptionStatus, UserProfile } from "@/types";

export type SessionUser = {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
};

export function sessionCookieOptions(secure = process.env.NODE_ENV === "production") {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  };
}

function cookieSecureFromRequest(request?: Request) {
  if (process.env.VERCEL === "1") return true;
  if (!request) return process.env.NODE_ENV === "production";
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0]?.trim() === "https";
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return process.env.NODE_ENV === "production";
  }
}

function sessionSecret() {
  return (
    readEnv("APP_ENCRYPTION_KEY") ||
    readEnv("CRON_SECRET") ||
    readEnv("FIREBASE_ADMIN_PRIVATE_KEY") ||
    readEnv("FIREBASE_PRIVATE_KEY") ||
    "deployx-dev"
  );
}

function createAppSessionToken(user: SessionUser) {
  const payload = JSON.stringify({
    uid: user.uid,
    email: user.email,
    name: user.name,
    picture: user.picture,
    exp: Date.now() + SESSION_MAX_AGE_MS,
  });
  const body = Buffer.from(payload).toString("base64url");
  const sig = createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function parseAppSessionToken(token: string): SessionUser | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionUser & { exp?: number };
    if (!data.uid || (data.exp && data.exp < Date.now())) return null;
    return {
      uid: data.uid,
      email: data.email ?? null,
      name: data.name ?? null,
      picture: data.picture ?? null,
    };
  } catch {
    return null;
  }
}

export async function createSession(idToken: string) {
  logger.info("auth.session verifying google token");
  const auth = getAdminAuth();
  const decoded = await auth.verifyIdToken(idToken);
  const sessionUser: SessionUser = {
    uid: decoded.uid,
    email: decoded.email ?? null,
    name: decoded.name ?? null,
    picture: decoded.picture ?? null,
  };
  logger.info("auth.session google token verified", { hasUid: Boolean(sessionUser.uid) });
  let profile: UserProfile | null = null;
  try {
    profile = await upsertUserFromDecoded(decoded);
    logger.info("auth.session firestore user upserted");
  } catch (error) {
    logger.error("auth.session firestore upsert failed", {
      name: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : "unknown",
    });
  }
  return { decoded, sessionCookie: createAppSessionToken(sessionUser), profile };
}

export function applySessionCookie(response: NextResponse, sessionCookie: string, request?: Request) {
  response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, sessionCookieOptions(cookieSecureFromRequest(request)));
  return response;
}

export function clearSessionFromResponse(response: NextResponse, request?: Request) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(cookieSecureFromRequest(request)),
    maxAge: 0,
  });
  return response;
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const appSession = parseAppSessionToken(token);
  if (appSession) return appSession;
  try {
    const decoded = await getAdminAuth().verifySessionCookie(token, true);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      name: decoded.name ?? null,
      picture: decoded.picture ?? null,
    };
  } catch {
    return null;
  }
}

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) {
    throw new AppError("UNAUTHENTICATED", "Please sign in to continue.", 401);
  }
  return user;
}

export async function verifyRequestUser(request: Request) {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7);
    try {
      const decoded = await getAdminAuth().verifyIdToken(token);
      return {
        uid: decoded.uid,
        email: decoded.email ?? null,
        name: decoded.name ?? null,
        picture: decoded.picture ?? null,
      } satisfies SessionUser;
    } catch {
      throw new AppError("UNAUTHENTICATED", "Your session has expired. Please sign in again.", 401);
    }
  }
  const user = await getSessionUser();
  if (!user) {
    throw new AppError("UNAUTHENTICATED", "Please sign in to continue.", 401);
  }
  return user;
}

type DecodedLike = {
  uid: string;
  email?: string | null;
  name?: string | null;
  picture?: string | null;
};

export async function upsertUserFromDecoded(decoded: DecodedLike) {
  const db = getAdminDb();
  const ref = db.collection(collections.users).doc(decoded.uid);
  const snap = await ref.get();
  const timestamp = nowIso();
  if (!snap.exists) {
    const profile: UserProfile = {
      uid: decoded.uid,
      name: decoded.name ?? "Vivexa user",
      email: decoded.email ?? "",
      photoURL: decoded.picture ?? null,
      activePlanId: null,
      activePlanName: null,
      subscriptionId: null,
      subscriptionStatus: "none" satisfies SubscriptionStatus,
      subscriptionStartDate: null,
      renewalDate: null,
      websiteLimit: 0,
      websiteCount: 0,
      gracePeriodDays: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await ref.set(profile);
    return profile;
  }
  await ref.set(
    {
      name: decoded.name ?? snap.data()?.name ?? "Vivexa user",
      email: decoded.email ?? snap.data()?.email ?? "",
      photoURL: decoded.picture ?? snap.data()?.photoURL ?? null,
      updatedAt: timestamp,
    },
    { merge: true },
  );
  return { uid: decoded.uid, ...(snap.data() ?? {}), updatedAt: timestamp } as UserProfile;
}
