import { RATE_LIMITS } from "@/config/constants";
import { getAdminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firebase/collections";
import { AppError } from "@/lib/errors";
import { nowIso } from "@/lib/utils";

type LimitName = keyof typeof RATE_LIMITS;

export async function enforceRateLimit(uid: string, name: LimitName) {
  const spec = RATE_LIMITS[name];
  const db = getAdminDb();
  const ref = db.collection(collections.rateLimits).doc(`${uid}_${name}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const data = snap.data() as { count?: number; windowStart?: number } | undefined;
    const windowStart = data?.windowStart ?? now;
    const count = data?.count ?? 0;
    if (now - windowStart >= spec.windowMs) {
      tx.set(ref, { count: 1, windowStart: now, updatedAt: nowIso() });
      return;
    }
    if (count >= spec.limit) {
      throw new AppError(
        "RATE_LIMITED",
        "Too many requests. Please wait a few minutes and try again.",
        429,
      );
    }
    tx.set(ref, { count: count + 1, windowStart, updatedAt: nowIso() }, { merge: true });
  });
}
