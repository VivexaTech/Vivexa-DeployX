import { NextResponse } from "next/server";
import { withUser } from "@/lib/security/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshDomain } from "@/lib/data/domains";
import { assertVercelConfigured, toPublicVercelError } from "@/lib/vercel/client";
import { PublicError } from "@/lib/utils/sanitize";
import type { Domain, Project } from "@/types/database";

export const POST = withUser({ rateLimit: { key: "domain-verify", limit: 20, windowMs: 60_000 } }, async ({ user, params }) => {
  assertVercelConfigured();
  const { data } = await createAdminClient()
    .from("domains")
    .select("*, project:projects(provider_project_id)")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) throw new PublicError("Domain not found", 404);
  const { project, ...domain } = data as Domain & { project: Pick<Project, "provider_project_id"> | null };
  if (!project?.provider_project_id) throw new PublicError("The project has not been deployed yet.", 409);

  try {
    const updated = await refreshDomain(domain, project.provider_project_id, true);
    return NextResponse.json({ domain: updated });
  } catch (error) {
    throw toPublicVercelError(error, "Could not verify the domain");
  }
});
