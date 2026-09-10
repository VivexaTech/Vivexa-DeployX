import { verifyRequestUser } from "@/lib/auth/session";
import { getAdminDb } from "@/lib/firebase/admin";
import { userNotificationsPath } from "@/lib/firebase/collections";
import { handleRouteError, json } from "@/lib/http";
import type { AppNotification } from "@/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await verifyRequestUser(request);
    const snap = await getAdminDb()
      .collection(userNotificationsPath(user.uid))
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
    const notifications = snap.docs.map((doc) => doc.data() as AppNotification);
    return json({
      notifications,
      unread: notifications.filter((item) => !item.read).length,
    });
  } catch (error) {
    return handleRouteError(error, "notifications.list");
  }
}
