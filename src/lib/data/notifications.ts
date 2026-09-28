import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type NotificationType =
  | "deployment_success"
  | "deployment_failed"
  | "payment_success"
  | "payment_failed"
  | "domain_verified"
  | "domain_failed"
  | "subscription_expired"
  | "limit_reached"
  | "support_update"
  | "announcement";

export async function createNotification(
  userId: string,
  input: { type: NotificationType; title: string; body?: string; link?: string },
): Promise<void> {
  const { error } = await createAdminClient().from("notifications").insert({
    user_id: userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
  });
  if (error) console.error("[notifications] insert failed", error.message);
}
