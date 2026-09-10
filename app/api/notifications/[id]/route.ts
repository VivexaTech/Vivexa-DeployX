import { verifyRequestUser } from "@/lib/auth/session";
import { getAdminDb } from "@/lib/firebase/admin";
import { userNotificationsPath } from "@/lib/firebase/collections";
import { handleRouteError, json, readJson } from "@/lib/http";
import { notificationUpdateSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await verifyRequestUser(request);
    const { id } = await context.params;
    const body = notificationUpdateSchema.parse(await readJson(request));
    await getAdminDb().doc(`${userNotificationsPath(user.uid)}/${id}`).set(
      { read: body.read },
      { merge: true },
    );
    return json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "notifications.update");
  }
}
