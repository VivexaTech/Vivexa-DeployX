import Razorpay from "razorpay";
import { readEnv, requireServerEnv } from "@/lib/env";

let client: Razorpay | null = null;

export function razorpayConfigured() {
  return Boolean(readEnv("RAZORPAY_KEY_ID") && readEnv("RAZORPAY_KEY_SECRET"));
}

export function getRazorpay() {
  requireServerEnv(["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"]);
  if (!client) {
    client = new Razorpay({
      key_id: readEnv("RAZORPAY_KEY_ID"),
      key_secret: readEnv("RAZORPAY_KEY_SECRET"),
    });
  }
  return client;
}
