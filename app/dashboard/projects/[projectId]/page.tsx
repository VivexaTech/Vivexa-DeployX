"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/providers/toast-provider";
import { apiFetch } from "@/lib/api/client";
import { formatDateTime } from "@/lib/utils";
import type { Deployment, Project, ProjectDomain } from "@/types";

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const { push } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [domains, setDomains] = useState<ProjectDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [envText, setEnvText] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [customDomain, setCustomDomain] = useState("");

  const load = useCallback(async () => {
    const payload = await apiFetch<{ project: Project; deployments: Deployment[]; domains: ProjectDomain[] }>(
      `/api/projects/${params.projectId}`,
    );
    setProject(payload.project);
    setDeployments(payload.deployments);
    setDomains(payload.domains);
    setLoading(false);
  }, [params.projectId]);

  useEffect(() => {
    void load().catch((error) => {
      push({ title: error.message, tone: "danger" });
      setLoading(false);
    });
  }, [load, push]);

  useEffect(() => {
    const latest = deployments[0];
    if (!latest || latest.status === "ready" || latest.status === "error" || latest.status === "cancelled") return;
    const timer = window.setInterval(() => {
      apiFetch<{ deployment: Deployment }>(
        `/api/projects/${params.projectId}/deploy?deploymentId=${latest.deploymentId}`,
      )
        .then(() => load())
        .catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [deployments, load, params.projectId]);

  async function redeploy() {
    setBusy(true);
    try {
      await apiFetch(`/api/projects/${params.projectId}/deploy`, { method: "POST" });
      push({ title: "Redeploy started", tone: "success" });
      await load();
    } catch (error) {
      push({ title: error instanceof Error ? error.message : "Redeploy failed", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  if (loading || !project) return <Skeleton className="h-80" />;

  const latest = deployments[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row">
        <div>
          <Link href="/dashboard/projects" className="text-sm text-muted">
            Projects
          </Link>
          <h1 className="text-3xl font-semibold">{project.name}</h1>
          <p className="text-sm text-muted">{project.repository}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={redeploy} disabled={busy}>
            Redeploy
          </Button>
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        </div>
      </div>

      <Card className="p-5">
        {latest?.status === "ready" ? (
          <p className="text-success">Deployment successful</p>
        ) : latest?.status === "error" ? (
          <p className="text-danger">Deployment failed</p>
        ) : (
          <p className="text-warning">Deployment in progress</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Badge tone={statusTone(project.status)}>{project.status}</Badge>
          {project.deploymentUrl ? (
            <a href={project.deploymentUrl} className="text-sm text-accent" target="_blank" rel="noreferrer">
              {project.deploymentUrl}
            </a>
          ) : null}
        </div>
        {project.lastError ? <p className="mt-3 text-sm text-danger">{project.lastError}</p> : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-semibold">Environment variables</h2>
          <Label htmlFor="env" className="mt-4">
            KEY=value
          </Label>
          <textarea
            id="env"
            className="min-h-28 w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm"
            value={envText}
            onChange={(event) => setEnvText(event.target.value)}
          />
          <Button
            className="mt-3"
            size="sm"
            onClick={async () => {
              const envVars = envText
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => {
                  const index = line.indexOf("=");
                  return { key: line.slice(0, index).trim(), value: line.slice(index + 1).trim() };
                });
              try {
                await apiFetch(`/api/projects/${project.projectId}/env`, {
                  method: "POST",
                  body: JSON.stringify({ envVars }),
                });
                push({ title: "Environment variables saved", tone: "success" });
              } catch (error) {
                push({ title: error instanceof Error ? error.message : "Save failed", tone: "danger" });
              }
            }}
          >
            Save variables
          </Button>
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold">Domains</h2>
          <div className="mt-4 space-y-2">
            {domains.map((domain) => (
              <div key={domain.domainId} className="rounded-xl border border-line p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{domain.domain}</p>
                  <Badge tone={statusTone(domain.status)}>{domain.status}</Badge>
                </div>
                <p className="mt-2 text-muted">
                  {domain.recommendedCNAME ? `CNAME → ${domain.recommendedCNAME}` : ""}
                  {domain.recommendedA ? ` A → ${domain.recommendedA}` : ""}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      apiFetch(`/api/projects/${project.projectId}/domains/${domain.domainId}`, { method: "POST" })
                        .then(() => load())
                        .catch((error) => push({ title: error.message, tone: "danger" }))
                    }
                  >
                    Refresh verification
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      apiFetch(`/api/projects/${project.projectId}/domains/${domain.domainId}`, { method: "DELETE" })
                        .then(() => load())
                        .catch((error) => push({ title: error.message, tone: "danger" }))
                    }
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-2">
            <Input placeholder="platform subdomain" value={subdomain} onChange={(event) => setSubdomain(event.target.value)} />
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                apiFetch(`/api/projects/${project.projectId}/domains`, {
                  method: "POST",
                  body: JSON.stringify({ type: "platform", subdomain }),
                })
                  .then(() => load())
                  .catch((error) => push({ title: error.message, tone: "danger" }))
              }
            >
              Assign platform subdomain
            </Button>
            <Input placeholder="example.com" value={customDomain} onChange={(event) => setCustomDomain(event.target.value)} />
            <Button
              size="sm"
              onClick={() =>
                apiFetch(`/api/projects/${project.projectId}/domains`, {
                  method: "POST",
                  body: JSON.stringify({ type: "custom", domain: customDomain }),
                })
                  .then(() => load())
                  .catch((error) => push({ title: error.message, tone: "danger" }))
              }
            >
              Connect custom domain
            </Button>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold">Deployment history</h2>
        <div className="mt-4 space-y-3">
          {deployments.map((item) => (
            <div key={item.deploymentId} className="rounded-xl border border-line p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{item.deploymentId}</p>
                <Badge tone={statusTone(item.status)}>{item.status}</Badge>
              </div>
              <p className="mt-1 text-muted">
                {item.branch} · {item.commitSha?.slice(0, 7) ?? "—"} · {formatDateTime(item.createdAt)}
              </p>
              {item.url ? (
                <a href={item.url} className="text-accent" target="_blank" rel="noreferrer">
                  {item.url}
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this project?"
        description="The Vivexa DeployX project and its linked Vercel project will be removed. Website quota will be released."
        confirmLabel="Delete project"
        danger
        loading={busy}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            await apiFetch(`/api/projects/${project.projectId}`, { method: "DELETE" });
            router.push("/dashboard/projects");
          } catch (error) {
            push({ title: error instanceof Error ? error.message : "Delete failed", tone: "danger" });
          } finally {
            setBusy(false);
            setConfirmDelete(false);
          }
        }}
      />
    </div>
  );
}
