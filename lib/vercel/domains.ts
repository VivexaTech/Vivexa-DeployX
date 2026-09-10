import { vercelFetch } from "@/lib/vercel/client";

export type VercelDomain = {
  name: string;
  verified?: boolean;
  verification?: unknown;
  apexName?: string;
  gitBranch?: string | null;
};

export type VercelDomainConfig = {
  configuredBy?: string | null;
  nameservers?: string[];
  serviceType?: string;
  cnames?: string[];
  aValues?: string[];
  aaaaValues?: string[];
  recommendedCNAME?: { rank: number; value: string }[];
  recommendedIPv4?: { rank: number; value: string }[];
  recommendedIPv6?: { rank: number; value: string }[];
  misconfigured?: boolean;
};

export async function addProjectDomain(projectId: string, name: string) {
  return vercelFetch<VercelDomain>(`/v10/projects/${encodeURIComponent(projectId)}/domains`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function getProjectDomain(projectId: string, name: string) {
  return vercelFetch<VercelDomain>(
    `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(name)}`,
  );
}

export async function verifyProjectDomain(projectId: string, name: string) {
  return vercelFetch<VercelDomain>(
    `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(name)}/verify`,
    { method: "POST" },
  );
}

export async function removeProjectDomain(projectId: string, name: string) {
  return vercelFetch(`/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

export async function getDomainConfig(domain: string) {
  return vercelFetch<VercelDomainConfig>(`/v6/domains/${encodeURIComponent(domain)}/config`);
}
