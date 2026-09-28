import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { PublicError } from "@/lib/utils/sanitize";
import { randomToken } from "@/lib/utils/crypto";
import { slugify } from "@/lib/utils";
import type { Project } from "@/types/database";

/** Loads a project and verifies ownership. Throws 404 for other users' projects. */
export async function getOwnedProject(userId: string, projectId: string): Promise<Project> {
  const { data } = await createAdminClient()
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new PublicError("Project not found", 404);
  return data as Project;
}

/** Globally unique, URL-safe project slug. */
export async function uniqueProjectSlug(name: string): Promise<string> {
  const base = slugify(name, 40) || "project";
  const admin = createAdminClient();
  const { data } = await admin.from("projects").select("id").eq("slug", base).maybeSingle();
  if (!data) return base;
  return `${base}-${randomToken(4).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "x1"}`;
}
