import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { DomainsManager, type DomainWithProject } from "@/components/deployment/domains-manager";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getIntegrationStatus, serverConfig } from "@/lib/env";

export const metadata: Metadata = { title: "Domains" };

export default async function DomainsPage({ searchParams }: { searchParams: Promise<{ add?: string; project?: string }> }) {
  const user = await requireUser();
  const { add, project } = await searchParams;
  const supabase = await createClient();

  const [domainsRes, projectsRes] = await Promise.all([
    supabase.from("domains").select("*, project:projects(id, name)").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("projects").select("id, name, provider_project_id").eq("user_id", user.id).order("name"),
  ]);
  const domains = (domainsRes.data as DomainWithProject[]) ?? [];
  const projects = ((projectsRes.data as { id: string; name: string; provider_project_id: string | null }[]) ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    deployed: Boolean(p.provider_project_id),
  }));

  return (
    <>
      <PageHeader title="Domains" description="Connect DeployX subdomains and custom domains to your projects." />
      <DomainsManager
        domains={domains}
        projects={projects}
        subdomainBase={serverConfig.subdomainBase()}
        vercelConfigured={getIntegrationStatus().vercel}
        openAdd={add === "1"}
        defaultProjectId={projects.some((p) => p.id === project) ? project : undefined}
      />
    </>
  );
}
