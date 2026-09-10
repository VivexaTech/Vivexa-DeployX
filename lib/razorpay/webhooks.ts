import { createHmac, timingSafeEqual } from "crypto";
import { readEnv, requireServerEnv } from "@/lib/env.server";
import { AppError } from "@/lib/errors";

export function verifyRazorpayWebhook(rawBody: string, signature: string | null) {
  requireServerEnv(["RAZORPAY_WEBHOOK_SECRET"]);
  if (!signature) {
    throw new AppError("FORBIDDEN", "Missing Razorpay signature.", 401);
  }
  const expected = createHmac("sha256", readEnv("RAZORPAY_WEBHOOK_SECRET"))
    .update(rawBody)
    .digest("hex");
  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(signature);
  if (expectedBuf.length !== receivedBuf.length || !timingSafeEqual(expectedBuf, receivedBuf)) {
    throw new AppError("FORBIDDEN", "Invalid Razorpay webhook signature.", 401);
  }
}

export type RazorpayWebhookEvent = {
  event: string;
  created_at?: number;
  payload?: {
    payment?: { entity?: Record<string, unknown> };
    subscription?: { entity?: Record<string, unknown> };
    invoice?: { entity?: Record<string, unknown> };
  };
};
