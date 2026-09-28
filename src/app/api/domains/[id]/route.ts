import { NextResponse } from "next/server";
import { withUser } from "@/lib/security/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { integrations } from "@/lib/env";
import { removeProjectDomain } from "@/lib/vercel/domains";
import { toPublicVercelError, VercelApiError } from "@/lib/vercel/client";
import { PublicError } from "@/lib/utils/sanitize";
import type { Domain, Project } from "@/types/database";

export const DELETE = withUser({}, async ({ user, params }) => {
  const admin = createAdminClient();
  const { data } = await admin
    .from("domains")
    .select("*, project:projects(provider_project_id)")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) throw new PublicError("Domain not found", 404);
  const domain = data as Domain & { project: Pick<Project, "provider_project_id"> | null };

  if (domain.project?.provider_project_id && integrations.vercel()) {
    try {
      await removeProjectDomain(domain.project.provider_project_id, domain.name);
    } catch (error) {
      if (!(error instanceof VercelApiError && error.status === 404)) {
        throw toPublicVercelError(error, "Could not remove the domain");
      }
    }
  }
  await admin.from("domains").delete().eq("id", domain.id);
  return NextResponse.json({ ok: true });
});
