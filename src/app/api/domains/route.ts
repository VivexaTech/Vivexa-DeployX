import { NextResponse } from "next/server";
import { withUser } from "@/lib/security/api";
import { addDomainSchema } from "@/lib/validation";
import { getOwnedProject } from "@/lib/data/projects";
import { assertWithinLimit } from "@/lib/data/limits";
import { statusFromProvider } from "@/lib/data/domains";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverConfig } from "@/lib/env";
import { assertVercelConfigured, toPublicVercelError } from "@/lib/vercel/client";
import { addProjectDomain, buildDnsRecords, buildVerificationRecords, getDomainConfig } from "@/lib/vercel/domains";
import { PublicError } from "@/lib/utils/sanitize";

const RESERVED_SUBDOMAINS = new Set(["www", "api", "admin", "app", "dashboard", "mail", "docs", "status", "support", "deployx"]);

export const POST = withUser(
  { schema: addDomainSchema, rateLimit: { key: "domain-add", limit: 20, windowMs: 60_000 } },
  async ({ user, body }) => {
    assertVercelConfigured();
    const project = await getOwnedProject(user.id, body.projectId);
    if (!project.provider_project_id) {
      throw new PublicError("Deploy this project at least once before adding domains.", 409);
    }

    const base = serverConfig.subdomainBase();
    let name: string;
    if (body.type === "subdomain") {
      if (RESERVED_SUBDOMAINS.has(body.name)) throw new PublicError("That subdomain is reserved.", 422);
      name = `${body.name}.${base}`;
    } else {
      if (body.name === base || body.name.endsWith(`.${base}`)) {
        throw new PublicError(`Use the DeployX subdomain option for *.${base} addresses.`, 422);
      }
      name = body.name;
    }

    const admin = createAdminClient();
    const { data: existing } = await admin.from("domains").select("id").eq("name", name).maybeSingle();
    if (existing) throw new PublicError("This domain is already in use.", 409);

    await assertWithinLimit(user.id, "domains");

    let projectDomain;
    try {
      projectDomain = await addProjectDomain(project.provider_project_id, name);
    } catch (error) {
      throw toPublicVercelError(error, "Could not add the domain");
    }
    const config = await getDomainConfig(name, project.provider_project_id).catch(() => null);
    const status = statusFromProvider(projectDomain, config);

    const { data, error } = await admin
      .from("domains")
      .insert({
        project_id: project.id,
        user_id: user.id,
        name,
        type: body.type,
        status,
        ssl_status: status === "verified" ? "active" : "pending",
        dns_records: buildDnsRecords(projectDomain, config),
        verification: buildVerificationRecords(projectDomain),
        last_checked_at: new Date().toISOString(),
        verified_at: status === "verified" ? new Date().toISOString() : null,
      })
      .select("*")
      .single();
    if (error) throw new PublicError("Could not save domain.", 500);
    return NextResponse.json({ domain: data });
  },
);
