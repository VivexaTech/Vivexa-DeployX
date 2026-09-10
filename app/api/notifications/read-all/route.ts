import { verifyRequestUser } from "@/lib/auth/session";
import { getAdminDb } from "@/lib/firebase/admin";
import { userNotificationsPath } from "@/lib/firebase/collections";
import { handleRouteError, json } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await verifyRequestUser(request);
    const db = getAdminDb();
    const snap = await db.collection(userNotificationsPath(user.uid)).where("read", "==", false).get();
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.set(doc.ref, { read: true }, { merge: true }));
    await batch.commit();
    return json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "notifications.readAll");
  }
}
