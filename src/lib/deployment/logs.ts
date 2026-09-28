import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeLogLine } from "@/lib/utils/sanitize";

export async function appendLog(
  deploymentId: string,
  message: string,
  level: "info" | "warn" | "error" | "success" | "command" = "info",
  source = "deployx",
): Promise<void> {
  await createAdminClient()
    .from("deployment_logs")
    .insert({ deployment_id: deploymentId, message: sanitizeLogLine(message).slice(0, 4000), level, source });
}
