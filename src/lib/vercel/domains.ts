import "server-only";
import { vercelFetch } from "@/lib/vercel/client";
import type { VercelDomainConfig, VercelProjectDomain } from "@/lib/vercel/types";
import type { DnsRecord } from "@/types/database";

export async function addProjectDomain(projectId: string, name: string): Promise<VercelProjectDomain> {
  return vercelFetch<VercelProjectDomain>(`/v10/projects/${encodeURIComponent(projectId)}/domains`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function getProjectDomain(projectId: string, name: string): Promise<VercelProjectDomain> {
  return vercelFetch<VercelProjectDomain>(
    `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(name)}`,
  );
}

export async function verifyProjectDomain(projectId: string, name: string): Promise<VercelProjectDomain> {
  return vercelFetch<VercelProjectDomain>(
    `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(name)}/verify`,
    { method: "POST" },
  );
}

export async function removeProjectDomain(projectId: string, name: string): Promise<void> {
  await vercelFetch<unknown>(`/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

export async function getDomainConfig(name: string, projectId: string): Promise<VercelDomainConfig> {
  return vercelFetch<VercelDomainConfig>(
    `/v6/domains/${encodeURIComponent(name)}/config?projectIdOrName=${encodeURIComponent(projectId)}`,
  );
}

/**
 * Builds the DNS records a user must configure, using only values returned by
 * the provider. Apex domains get A records; subdomains get CNAME records.
 */
export function buildDnsRecords(domain: VercelProjectDomain, config: VercelDomainConfig | null): DnsRecord[] {
  if (!config) return [];
  const isApex = domain.name === domain.apexName;
  const records: DnsRecord[] = [];

  if (isApex) {
    const preferred = [...(config.recommendedIPv4 ?? [])].sort((a, b) => a.rank - b.rank)[0];
    for (const ip of preferred?.value ?? []) {
      records.push({ type: "A", name: "@", value: ip });
    }
  } else {
    const preferred = [...(config.recommendedCNAME ?? [])].sort((a, b) => a.rank - b.rank)[0];
    if (preferred?.value) {
      const sub = domain.name.slice(0, -(domain.apexName.length + 1));
      records.push({ type: "CNAME", name: sub, value: preferred.value.replace(/\.$/, "") });
    }
  }
  return records;
}

export function buildVerificationRecords(domain: VercelProjectDomain): DnsRecord[] {
  return (domain.verification ?? []).map((v) => ({
    type: v.type,
    name: v.domain,
    value: v.value,
    reason: v.reason,
  }));
}
