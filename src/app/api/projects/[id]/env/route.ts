import { NextResponse } from "next/server";
import { z } from "zod";
import { withUser } from "@/lib/security/api";
import { envVarInputSchema } from "@/lib/validation";
import { getOwnedProject } from "@/lib/data/projects";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/utils/crypto";
import { integrations } from "@/lib/env";
import { PublicError } from "@/lib/utils/sanitize";
import { toPublicVercelError } from "@/lib/vercel/client";
import { deleteVercelEnv, upsertVercelEnv } from "@/lib/vercel/projects";
import type { VercelEnvTarget } from "@/lib/vercel/types";

const COLUMNS = "id, project_id, key, is_secret, targets, created_at, updated_at";

export const GET = withUser({}, async ({ user, params }) => {
  await getOwnedProject(user.id, params.id);
  const { data } = await createAdminClient().from("environment_variables").select(COLUMNS).eq("project_id", params.id).order("key");
  return NextResponse.json({ variables: data ?? [] });
});

export const POST = withUser(
  { schema: envVarInputSchema, rateLimit: { key: "env-write", limit: 60, windowMs: 60_000 } },
  async ({ user, body, params }) => {
    if (!integrations.encryption()) {
      throw new PublicError("ENCRYPTION_KEY is not configured, so environment variables can't be stored securely.", 503);
    }
    const project = await getOwnedProject(user.id, params.id);

    let providerEnvId: string | null = null;
    if (project.provider_project_id && integrations.vercel()) {
      try {
        providerEnvId = (await upsertVercelEnv(project.provider_project_id, body.key, body.value, body.targets as VercelEnvTarget[])).id;
      } catch (error) {
        throw toPublicVercelError(error, "Could not sync the variable to the infrastructure provider");
      }
    }

    const { data, error } = await createAdminClient()
      .from("environment_variables")
      .upsert(
        {
          project_id: project.id,
          user_id: user.id,
          key: body.key,
          value_encrypted: encryptSecret(body.value),
          is_secret: body.isSecret,
          targets: body.targets,
          provider_env_id: providerEnvId,
        },
        { onConflict: "project_id,key" },
      )
      .select(COLUMNS)
      .single();
    if (error) throw new PublicError("Could not save environment variable.", 500);
    return NextResponse.json({ variable: data });
  },
);

export const DELETE = withUser({ schema: z.object({ envId: z.string().uuid() }) }, async ({ user, body, params }) => {
  const project = await getOwnedProject(user.id, params.id);
  const admin = createAdminClient();
  const { data } = await admin
    .from("environment_variables")
    .select("id, provider_env_id")
    .eq("id", body.envId)
    .eq("project_id", project.id)
    .maybeSingle();
  if (!data) throw new PublicError("Variable not found", 404);

  const row = data as { id: string; provider_env_id: string | null };
  if (row.provider_env_id && project.provider_project_id && integrations.vercel()) {
    await deleteVercelEnv(project.provider_project_id, row.provider_env_id).catch((error) => {
      throw toPublicVercelError(error, "Could not remove the variable from the infrastructure provider");
    });
  }
  await admin.from("environment_variables").delete().eq("id", row.id);
  return NextResponse.json({ ok: true });
});
