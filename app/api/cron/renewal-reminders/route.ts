import { assertCronAccess } from "@/lib/cron";
import { handleRouteError, json } from "@/lib/http";
import { sendDueRenewalReminders } from "@/lib/subscriptions/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    assertCronAccess(request);
    const sent = await sendDueRenewalReminders();
    return json({ ok: true, sent });
  } catch (error) {
    return handleRouteError(error, "cron.renewal");
  }
}
