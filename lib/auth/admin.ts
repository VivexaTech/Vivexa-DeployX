import { getAdminUids } from "@/lib/env";
import { AppError } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/session";

export function isAdminUid(uid: string) {
  return getAdminUids().includes(uid);
}

export function requireAdmin(user: SessionUser) {
  if (!isAdminUid(user.uid)) {
    throw new AppError("FORBIDDEN", "Admin access is required.", 403);
  }
  return user;
}
