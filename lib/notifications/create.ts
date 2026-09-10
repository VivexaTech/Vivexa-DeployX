import { nanoid } from "nanoid";
import { getAdminDb } from "@/lib/firebase/admin";
import { userNotificationsPath } from "@/lib/firebase/collections";
import { nowIso } from "@/lib/utils";
import type { NotificationType } from "@/types";

export async function createNotification(input: {
  uid: string;
  type: NotificationType;
  title: string;
  message: string;
  href?: string | null;
}) {
  const db = getAdminDb();
  const notificationId = nanoid();
  await db.collection(userNotificationsPath(input.uid)).doc(notificationId).set({
    notificationId,
    userId: input.uid,
    type: input.type,
    title: input.title,
    message: input.message,
    href: input.href ?? null,
    read: false,
    createdAt: nowIso(),
  });
  return notificationId;
}
