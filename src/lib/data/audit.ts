import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type AuditAction =
  | "PLAN_CREATED"
  | "PLAN_UPDATED"
  | "PLAN_DEACTIVATED"
  | "PLAN_DELETED"
  | "USER_SUSPENDED"
  | "USER_REACTIVATED"
  | "ROLE_CHANGED"
  | "PAYMENT_REVIEWED"
  | "SUBSCRIPTION_UPDATED"
  | "SETTINGS_UPDATED"
  | "TAX_SETTINGS_UPDATED"
  | "INVOICE_SETTINGS_UPDATED"
  | "COMPANY_LOGO_UPDATED"
  | "COUPON_CREATED"
  | "COUPON_UPDATED"
  | "TICKET_REPLIED"
  | "TICKET_STATUS_CHANGED"
  | "NOTIFICATION_BROADCAST";

export async function recordAudit(
  adminId: string,
  action: AuditAction,
  resourceType: string,
  resourceId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await createAdminClient().from("admin_audit_logs").insert({
    admin_id: adminId,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    metadata,
  });
  if (error) console.error("[audit] insert failed", error.message);
}
