import { vercelFetch } from "@/lib/vercel/client";

export type VercelDeployment = {
  id: string;
  url?: string;
  inspectorUrl?: string;
  readyState?: string;
  readySubstate?: string;
  name?: string;
};

export async function createGitDeployment(input: {
  name: string;
  project?: string;
  repo: string;
  ref: string;
  repoId?: string;
}) {
  return vercelFetch<VercelDeployment>("/v13/deployments", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      project: input.project,
      gitSource: {
        type: "github",
        repo: input.repo,
        ref: input.ref,
        ...(input.repoId ? { repoId: input.repoId } : {}),
      },
    }),
  });
}

export async function getVercelDeployment(id: string) {
  return vercelFetch<VercelDeployment>(`/v13/deployments/${encodeURIComponent(id)}`);
}

export async function getDeploymentEvents(id: string) {
  return vercelFetch<unknown[]>(`/v2/deployments/${encodeURIComponent(id)}/events?builds=1&direction=forward`);
}

export async function cancelVercelDeployment(id: string) {
  return vercelFetch(`/v12/deployments/${encodeURIComponent(id)}/cancel`, { method: "PATCH" });
}

export function mapVercelReadyState(state?: string) {
  switch (state) {
    case "READY":
      return "ready" as const;
    case "ERROR":
    case "CANCELED":
      return state === "CANCELED" ? ("cancelled" as const) : ("error" as const);
    case "QUEUED":
    case "INITIALIZING":
      return "queued" as const;
    default:
      return "building" as const;
  }
}
