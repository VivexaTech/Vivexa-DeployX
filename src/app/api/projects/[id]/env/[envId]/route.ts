import { NextResponse } from "next/server";
import { withUser } from "@/lib/security/api";
import { getOwnedProject } from "@/lib/data/projects";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/utils/crypto";
import { PublicError } from "@/lib/utils/sanitize";

export const dynamic = "force-dynamic";

/** Reveals a single decrypted value to the project owner. Rate limited. */
export const GET = withUser({ rateLimit: { key: "env-reveal", limit: 30, windowMs: 60_000 } }, async ({ user, params }) => {
  const project = await getOwnedProject(user.id, params.id);
  const { data } = await createAdminClient()
    .from("environment_variables")
    .select("value_encrypted")
    .eq("id", params.envId)
    .eq("project_id", project.id)
    .maybeSingle();
  if (!data) throw new PublicError("Variable not found", 404);
  const value = decryptSecret((data as { value_encrypted: string }).value_encrypted);
  return NextResponse.json({ value }, { headers: { "Cache-Control": "no-store" } });
});
