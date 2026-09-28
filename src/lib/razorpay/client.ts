import "server-only";
import { integrations, requireEnv } from "@/lib/env";
import { hmacSha256Hex, safeCompare } from "@/lib/utils/crypto";
import { PublicError } from "@/lib/utils/sanitize";

const RAZORPAY_API = "https://api.razorpay.com/v1";

export const RAZORPAY_NOT_CONFIGURED =
  "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable paid plans.";

export function assertRazorpayConfigured(): void {
  if (!integrations.razorpay()) throw new PublicError(RAZORPAY_NOT_CONFIGURED, 503);
}

async function razorpayFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  assertRazorpayConfigured();
  const auth = Buffer.from(`${requireEnv("RAZORPAY_KEY_ID")}:${requireEnv("RAZORPAY_KEY_SECRET")}`).toString("base64");
  const response = await fetch(`${RAZORPAY_API}${path}`, {
    ...init,
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  const data = (await response.json()) as T & { error?: { description?: string } };
  if (!response.ok) {
    throw new PublicError(data.error?.description ?? "Payment provider request failed.", 502);
  }
  return data;
}

export type RazorpayOrder = { id: string; amount: number; currency: string; status: string; receipt: string };
export type RazorpayPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  error_description?: string | null;
};

export function createOrder(input: {
  amount: number;
  currency: string;
  receipt: string;
  notes: Record<string, string>;
}): Promise<RazorpayOrder> {
  return razorpayFetch<RazorpayOrder>("/orders", { method: "POST", body: JSON.stringify(input) });
}

export function fetchPayment(paymentId: string): Promise<RazorpayPayment> {
  return razorpayFetch<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`);
}

/** Checkout signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  const expected = hmacSha256Hex(requireEnv("RAZORPAY_KEY_SECRET"), `${orderId}|${paymentId}`);
  return safeCompare(expected, signature);
}

/** Webhook signature: HMAC_SHA256(raw_body, webhook_secret). */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  return safeCompare(hmacSha256Hex(secret, rawBody), signature);
}

export function publicKeyId(): string {
  return requireEnv("RAZORPAY_KEY_ID");
}
