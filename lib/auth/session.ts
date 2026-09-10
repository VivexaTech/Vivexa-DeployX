import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS } from "@/config/constants";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firebase/collections";
import { nowIso } from "@/lib/utils";
import { AppError } from "@/lib/errors";
import type { SubscriptionStatus, UserProfile } from "@/types";

export type SessionUser = {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
};

export async function createSessionCookie(idToken: string) {
  const auth = getAdminAuth();
  const decoded = await auth.verifyIdToken(idToken);
  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_MS,
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });
  await upsertUserFromDecoded(decoded);
  return decoded;
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
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
  email?: string;
  name?: string;
  picture?: string;
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
  return { uid: decoded.uid, ...(snap.data() ?? {}) } as UserProfile;
}
