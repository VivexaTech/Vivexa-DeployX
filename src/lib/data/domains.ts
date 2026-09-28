import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/data/notifications";
import {
  buildDnsRecords,
  buildVerificationRecords,
  getDomainConfig,
  getProjectDomain,
  verifyProjectDomain,
} from "@/lib/vercel/domains";
import { VercelApiError } from "@/lib/vercel/client";
import type { VercelDomainConfig, VercelProjectDomain } from "@/lib/vercel/types";
import type { Domain, DomainStatus } from "@/types/database";

export function statusFromProvider(domain: VercelProjectDomain, config: VercelDomainConfig | null): DomainStatus {
  if (domain.verified && config && !config.misconfigured) return "verified";
  if (domain.verified && !config) return "verifying";
  return "pending";
}

/**
 * Re-checks a domain with the provider and persists the result. Emits a
 * notification when a domain transitions to verified or invalid.
 */
export async function refreshDomain(domain: Domain, providerProjectId: string, userTriggered: boolean): Promise<Domain> {
  const admin = createAdminClient();
  await admin.from("domains").update({ status: "verifying" }).eq("id", domain.id);

  let projectDomain: VercelProjectDomain;
  try {
    projectDomain = await getProjectDomain(providerProjectId, domain.name);
    if (!projectDomain.verified) {
      projectDomain = await verifyProjectDomain(providerProjectId, domain.name).catch((error: unknown) => {
        if (error instanceof VercelApiError && error.status < 500) return projectDomain;
        throw error;
      });
    }
  } catch (error) {
    await admin.from("domains").update({ status: domain.status === "verifying" ? "pending" : domain.status }).eq("id", domain.id);
    throw error;
  }

  const config = await getDomainConfig(domain.name, providerProjectId).catch(() => null);
  const status = statusFromProvider(projectDomain, config);
  // A user-requested check that doesn't verify means DNS doesn't match yet.
  const finalStatus: DomainStatus = userTriggered && status !== "verified" ? "invalid" : status;

  const { data } = await admin
    .from("domains")
    .update({
      status: finalStatus,
      ssl_status: finalStatus === "verified" ? "active" : "pending",
      dns_records: buildDnsRecords(projectDomain, config),
      verification: buildVerificationRecords(projectDomain),
      last_checked_at: new Date().toISOString(),
      verified_at: finalStatus === "verified" ? (domain.verified_at ?? new Date().toISOString()) : null,
    })
    .eq("id", domain.id)
    .select("*")
    .single();

  if (finalStatus !== domain.status) {
    if (finalStatus === "verified") {
      await createNotification(domain.user_id, {
        type: "domain_verified",
        title: `${domain.name} is verified`,
        body: "SSL will be provisioned automatically.",
        link: "/dashboard/domains",
      });
    } else if (finalStatus === "invalid") {
      await createNotification(domain.user_id, {
        type: "domain_failed",
        title: `Verification failed for ${domain.name}`,
        body: "Check that your DNS records match the values shown and try again after propagation.",
        link: "/dashboard/domains",
      });
    }
  }
  return (data as Domain) ?? domain;
}
