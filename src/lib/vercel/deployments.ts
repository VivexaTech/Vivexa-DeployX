import "server-only";
import { vercelFetch } from "@/lib/vercel/client";
import type { VercelDeployment, VercelEvent, VercelFileRef, VercelReadyState } from "@/lib/vercel/types";
import type { DeploymentStatus } from "@/types/database";

export function mapReadyState(state: VercelReadyState | string | undefined): DeploymentStatus {
  switch (state) {
    case "READY":
      return "ready";
    case "ERROR":
      return "error";
    case "CANCELED":
      return "cancelled";
    case "BUILDING":
    case "INITIALIZING":
      return "building";
    default:
      return "queued";
  }
}

/** Uploads a single file to the provider's content-addressed file store. */
export async function uploadFile(content: Buffer, sha: string): Promise<void> {
  await vercelFetch<unknown>("/v2/files", {
    method: "POST",
    rawBody: content,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(content.length),
      "x-vercel-digest": sha,
    },
  });
}

export type CreateDeploymentInput = {
  name: string;
  projectId: string;
  files: VercelFileRef[];
  meta: Record<string, string>;
  projectSettings: {
    framework: string | null;
    buildCommand: string | null;
    installCommand: string | null;
    outputDirectory: string | null;
    rootDirectory: string | null;
  };
};

export async function createVercelDeployment(input: CreateDeploymentInput): Promise<VercelDeployment> {
  return vercelFetch<VercelDeployment>("/v13/deployments?skipAutoDetectionConfirmation=1", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      project: input.projectId,
      target: "production",
      files: input.files,
      meta: input.meta,
      projectSettings: input.projectSettings,
    }),
  });
}

export async function getVercelDeployment(id: string): Promise<VercelDeployment> {
  return vercelFetch<VercelDeployment>(`/v13/deployments/${encodeURIComponent(id)}`);
}

export async function getVercelDeploymentEvents(id: string): Promise<VercelEvent[]> {
  const events = await vercelFetch<VercelEvent[] | null>(
    `/v3/deployments/${encodeURIComponent(id)}/events?builds=1&limit=-1&direction=forward`,
  );
  return Array.isArray(events) ? events : [];
}

export function eventText(event: VercelEvent): string | null {
  const text = event.text ?? event.payload?.text;
  return typeof text === "string" && text.length > 0 ? text : null;
}
