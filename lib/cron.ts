import { readEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

export function assertCronAccess(request: Request) {
  const secret = readEnv("CRON_SECRET");
  const auth = request.headers.get("authorization");
  const vercelCron = request.headers.get("x-vercel-cron");
  if (secret && auth === `Bearer ${secret}`) return;
  if (vercelCron && !secret) return;
  if (vercelCron && secret && auth === `Bearer ${secret}`) return;
  throw new AppError("FORBIDDEN", "This scheduled job cannot be invoked publicly.", 401);
}
