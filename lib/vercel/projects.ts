import { vercelFetch } from "@/lib/vercel/client";

export type VercelProject = {
  id: string;
  name: string;
  framework?: string | null;
};

export async function createVercelProject(input: {
  name: string;
  framework?: string | null;
  environmentVariables?: { key: string; value: string; target?: string[] }[];
}) {
  return vercelFetch<VercelProject>("/v10/projects", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      framework: input.framework || undefined,
      environmentVariables: input.environmentVariables?.map((item) => ({
        key: item.key,
        value: item.value,
        target: item.target ?? ["production", "preview", "development"],
        type: "encrypted",
      })),
    }),
  });
}

export async function getVercelProject(idOrName: string) {
  return vercelFetch<VercelProject>(`/v9/projects/${encodeURIComponent(idOrName)}`);
}

export async function deleteVercelProject(idOrName: string) {
  return vercelFetch(`/v9/projects/${encodeURIComponent(idOrName)}`, { method: "DELETE" });
}

export async function upsertVercelEnvVars(
  projectId: string,
  envVars: { key: string; value: string }[],
) {
  for (const item of envVars) {
    await vercelFetch(`/v10/projects/${encodeURIComponent(projectId)}/env`, {
      method: "POST",
      body: JSON.stringify({
        key: item.key,
        value: item.value,
        type: "encrypted",
        target: ["production", "preview", "development"],
      }),
    }).catch(async () => {
      const existing = await vercelFetch<{ envs: { id: string; key: string }[] }>(
        `/v9/projects/${encodeURIComponent(projectId)}/env`,
      );
      const found = existing.envs?.find((env) => env.key === item.key);
      if (found) {
        await vercelFetch(`/v9/projects/${encodeURIComponent(projectId)}/env/${found.id}`, {
          method: "PATCH",
          body: JSON.stringify({ value: item.value }),
        });
      }
    });
  }
}
