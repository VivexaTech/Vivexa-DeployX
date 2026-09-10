"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PlanLimitCard } from "@/components/dashboard/plan-limit";
import { useToast } from "@/components/providers/toast-provider";
import { apiFetch, type ApiError } from "@/lib/api/client";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import type { GithubRepo } from "@/types";

export default function NewProjectPage() {
  const { data } = useDashboardData();
  const { push } = useToast();
  const router = useRouter();
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [limit, setLimit] = useState<{ used?: number; limit?: number; planName?: string } | null>(null);
  const [form, setForm] = useState({
    repository: "",
    repositoryId: "",
    owner: "",
    repo: "",
    branch: "main",
    name: "",
    framework: "",
    websiteKind: "static" as "static" | "dynamic",
    platformSubdomain: "",
    envText: "",
    autoDeploy: false,
  });

  useEffect(() => {
    apiFetch<{ repos: GithubRepo[] }>("/api/github/repos")
      .then((payload) => setRepos(payload.repos))
      .catch((error) => push({ title: error.message, tone: "danger" }))
      .finally(() => setLoadingRepos(false));
  }, [push]);

  useEffect(() => {
    if (data?.plan && !data.plan.features.dynamicWebsite && form.websiteKind === "dynamic") {
      setForm((current) => ({ ...current, websiteKind: "static" }));
    }
  }, [data?.plan, form.websiteKind]);

  async function onSelectRepo(fullName: string) {
    const selected = repos.find((item) => item.fullName === fullName);
    if (!selected) return;
    const [owner, repo] = fullName.split("/");
    setForm((current) => ({
      ...current,
      repository: fullName,
      repositoryId: String(selected.id),
      owner,
      repo,
      name: current.name || selected.name,
      branch: selected.defaultBranch,
    }));
    const payload = await apiFetch<{ branches: string[] }>(
      `/api/github/repos?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
    );
    setBranches(payload.branches);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setLimit(null);
    try {
      const envVars = form.envText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const index = line.indexOf("=");
          return { key: line.slice(0, index).trim(), value: line.slice(index + 1).trim() };
        })
        .filter((item) => item.key && item.value);
      const result = await apiFetch<{ projectId: string }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          repository: form.repository,
          repositoryId: form.repositoryId,
          owner: form.owner,
          repo: form.repo,
          branch: form.branch,
          framework: form.framework || null,
          websiteKind: form.websiteKind,
          platformSubdomain: form.platformSubdomain || null,
          autoDeploy: form.autoDeploy,
          envVars,
        }),
      });
      push({ title: "Deployment started", tone: "success" });
      router.push(`/dashboard/projects/${result.projectId}`);
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.code === "PLAN_LIMIT") {
        setLimit({
          used: Number(apiError.details?.used),
          limit: Number(apiError.details?.limit),
          planName: String(apiError.details?.planName ?? ""),
        });
      } else {
        push({ title: apiError.error || "Deployment could not start", tone: "danger" });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-3xl font-semibold">Deploy a website</h1>
        <p className="text-sm text-muted">
          Subscription, website quota, and repository details are validated on the server before anything is created.
        </p>
      </div>
      {limit ? <PlanLimitCard {...limit} /> : null}
      <Card className="p-6">
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="repo">GitHub repository</Label>
            <select
              id="repo"
              className="h-11 w-full rounded-xl border border-line bg-bg-elevated px-3 text-sm"
              value={form.repository}
              onChange={(event) => void onSelectRepo(event.target.value)}
              required
            >
              <option value="">{loadingRepos ? "Loading repositories..." : "Select a repository"}</option>
              {repos.map((repo) => (
                <option key={repo.id} value={repo.fullName}>
                  {repo.fullName}
                  {repo.private ? " (private)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="branch">Branch</Label>
            <select
              id="branch"
              className="h-11 w-full rounded-xl border border-line bg-bg-elevated px-3 text-sm"
              value={form.branch}
              onChange={(event) => setForm((current) => ({ ...current, branch: event.target.value }))}
            >
              {(branches.length ? branches : [form.branch]).map((branch) => (
                <option key={branch}>{branch}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="name">Project name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </div>
          <div>
            <Label htmlFor="kind">Website type</Label>
            <select
              id="kind"
              className="h-11 w-full rounded-xl border border-line bg-bg-elevated px-3 text-sm"
              value={form.websiteKind}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  websiteKind: event.target.value === "dynamic" ? "dynamic" : "static",
                }))
              }
            >
              {data?.plan?.features.staticWebsite !== false ? <option value="static">Static website</option> : null}
              {data?.plan?.features.dynamicWebsite ? <option value="dynamic">Dynamic website</option> : null}
            </select>
            {data?.plan && !data.plan.features.dynamicWebsite ? (
              <p className="mt-1 text-xs text-muted">Dynamic websites are not included in your current plan.</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="subdomain">Platform subdomain (optional)</Label>
            <Input
              id="subdomain"
              placeholder="myportfolio"
              value={form.platformSubdomain}
              disabled={data?.plan ? !data.plan.features.freeSubdomain : false}
              onChange={(event) => setForm((current) => ({ ...current, platformSubdomain: event.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="env">Environment variables (optional, KEY=value per line)</Label>
            <textarea
              id="env"
              className="min-h-28 w-full rounded-xl border border-line bg-bg-elevated px-3 py-2 text-sm"
              value={form.envText}
              onChange={(event) => setForm((current) => ({ ...current, envText: event.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.autoDeploy}
              onChange={(event) => setForm((current) => ({ ...current, autoDeploy: event.target.checked }))}
            />
            Enable automatic deployments on push
          </label>
          <Button type="submit" disabled={submitting || !form.repository}>
            {submitting ? "Checking plan and deploying..." : "Deploy"}
          </Button>
          {data && !data.eligible ? (
            <p className="text-sm text-warning">Your subscription is not currently eligible for new deployments.</p>
          ) : null}
        </form>
      </Card>
    </div>
  );
}
