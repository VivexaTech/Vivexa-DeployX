import { verifyRequestUser } from "@/lib/auth/session";
import { handleRouteError, json } from "@/lib/http";
import { razorpayConfigured } from "@/lib/razorpay/client";
import { AppError } from "@/lib/errors";
import { syncSubscriptionFromRazorpay } from "@/lib/subscriptions/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await verifyRequestUser(request);
    if (!razorpayConfigured()) {
      throw new AppError("CONFIG_MISSING", "Razorpay is not configured.", 503);
    }
    const result = await syncSubscriptionFromRazorpay(session.uid);
    return json({ ok: true, ...result });
  } catch (error) {
    return handleRouteError(error, "billing.sync");
  }
}
