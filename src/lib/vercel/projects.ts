import "server-only";
import { vercelFetch } from "@/lib/vercel/client";
import type { VercelCredentials } from "@/lib/vercel/accounts";
import type { VercelEnvTarget, VercelProject } from "@/lib/vercel/types";

export type ProjectSettingsInput = {
  framework: string | null;
  buildCommand: string | null;
  installCommand: string | null;
  outputDirectory: string | null;
  rootDirectory: string | null;
};

export async function createVercelProject(
  name: string,
  settings: ProjectSettingsInput,
  credentials?: VercelCredentials,
): Promise<VercelProject> {
  return vercelFetch<VercelProject>("/v11/projects", {
    method: "POST",
    body: JSON.stringify({ name, ...settings }),
    accountCredentials: credentials,
  });
}

export async function updateVercelProject(
  projectId: string,
  settings: ProjectSettingsInput,
  credentials?: VercelCredentials,
): Promise<VercelProject> {
  return vercelFetch<VercelProject>(`/v9/projects/${encodeURIComponent(projectId)}`, {
    method: "PATCH",
    body: JSON.stringify(settings),
    accountCredentials: credentials,
  });
}

export async function deleteVercelProject(projectId: string, credentials?: VercelCredentials): Promise<void> {
  await vercelFetch<void>(`/v9/projects/${encodeURIComponent(projectId)}`, {
    method: "DELETE",
    accountCredentials: credentials,
  });
}

export async function upsertVercelEnv(
  projectId: string,
  key: string,
  value: string,
  targets: VercelEnvTarget[],
  credentials?: VercelCredentials,
): Promise<{ id: string | null }> {
  const result = await vercelFetch<{ created?: { id: string } | { id: string }[] }>(
    `/v10/projects/${encodeURIComponent(projectId)}/env?upsert=true`,
    {
      method: "POST",
      body: JSON.stringify({ key, value, type: "encrypted", target: targets }),
      accountCredentials: credentials,
    },
  );
  const created = result?.created;
  const id = Array.isArray(created) ? created[0]?.id : created?.id;
  return { id: id ?? null };
}

export async function deleteVercelEnv(projectId: string, envId: string, credentials?: VercelCredentials): Promise<void> {
  await vercelFetch<void>(`/v9/projects/${encodeURIComponent(projectId)}/env/${encodeURIComponent(envId)}`, {
    method: "DELETE",
    accountCredentials: credentials,
  });
}
