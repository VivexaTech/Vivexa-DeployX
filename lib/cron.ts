import { readEnv } from "@/lib/env.server";
import { AppError } from "@/lib/errors";

export function assertCronAccess(request: Request) {
  const secret = readEnv("CRON_SECRET");
  if (!secret) {
    throw new AppError(
      "CONFIG_MISSING",
      "CRON_SECRET is required so scheduled jobs cannot be invoked publicly.",
      503,
    );
  }
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return;
  throw new AppError("FORBIDDEN", "This scheduled job cannot be invoked publicly.", 401);
}

export function utcDayKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function utcStartOfDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
