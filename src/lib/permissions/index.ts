import type { UserRole } from "@/types/database";

export function isAdminRole(role: UserRole | null | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

export function isSuperAdmin(role: UserRole | null | undefined): boolean {
  return role === "super_admin";
}

/**
 * Role changes: only super admins may grant or revoke admin roles, and nobody
 * may modify their own role.
 */
export function canChangeRole(actorRole: UserRole, actorId: string, targetId: string, nextRole: UserRole): boolean {
  if (actorId === targetId) return false;
  if (actorRole !== "super_admin") return false;
  return ["user", "admin", "super_admin"].includes(nextRole);
}

/** Admins may suspend regular users; only super admins may suspend admins. */
export function canSuspend(actorRole: UserRole, actorId: string, targetId: string, targetRole: UserRole): boolean {
  if (actorId === targetId) return false;
  if (targetRole === "user") return isAdminRole(actorRole);
  return actorRole === "super_admin";
}
