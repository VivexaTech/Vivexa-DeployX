import { profileFromSession, type SessionUser } from "@/lib/auth/session";
import { getAdminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firebase/collections";
import { nowIso } from "@/lib/utils";
import type { UserProfile } from "@/types";

export async function upsertUserFromDecoded(decoded: SessionUser) {
  const db = getAdminDb();
  const ref = db.collection(collections.users).doc(decoded.uid);
  const snap = await ref.get();
  const timestamp = nowIso();
  if (!snap.exists) {
    const profile = profileFromSession(decoded);
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
