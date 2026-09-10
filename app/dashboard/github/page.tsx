"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/providers/toast-provider";
import { apiFetch } from "@/lib/api/client";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import type { GithubRepo } from "@/types";

function GithubInner() {
  const params = useSearchParams();
  const { data, refresh } = useDashboardData();
  const { push } = useToast();
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const error = params.get("error");
    if (params.get("connected")) {
      push({ title: "GitHub connected", tone: "success" });
      void refresh();
    }
    if (error === "github_denied") {
      push({ title: "GitHub authorization was cancelled. Please try again.", tone: "danger" });
    } else if (error === "github_state") {
      push({ title: "GitHub authorization expired. Please try again.", tone: "danger" });
    } else if (error === "github_exchange") {
      push({ title: "GitHub did not complete token exchange. Please retry.", tone: "danger" });
    } else if (error === "github_user") {
      push({ title: "GitHub authorized, but the account profile could not be loaded.", tone: "danger" });
    } else if (error === "github_store") {
      push({ title: "GitHub authorized, but saving the connection failed. Please retry.", tone: "danger" });
    } else if (error) {
      push({ title: "GitHub authorization failed. Please retry.", tone: "danger" });
    }
  }, [params, push, refresh]);

  async function connect() {
    const payload = await apiFetch<{ url: string }>("/api/github/connect");
    window.location.href = payload.url;
  }

  async function loadRepos() {
    setLoading(true);
    try {
      const payload = await apiFetch<{ repos: GithubRepo[] }>("/api/github/repos");
      setRepos(payload.repos);
    } catch (error) {
      push({ title: error instanceof Error ? error.message : "GitHub is unavailable. Retry.", tone: "danger" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (data?.github?.connected) void loadRepos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.github?.connected]);

  if (!data) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-semibold">GitHub</h1>
      {!data.github?.connected ? (
        <EmptyState
          title="GitHub is not connected"
          description="Authorize repository access to list private and public repos. Tokens stay on the server."
          actionLabel="Connect GitHub"
        />
      ) : (
        <Card className="p-5">
          <p className="text-sm text-muted">Connected as</p>
          <p className="text-xl font-semibold">{data.github.login}</p>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => void loadRepos()} disabled={loading}>
              {loading ? "Loading repositories..." : "Refresh repositories"}
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                apiFetch("/api/github/disconnect", { method: "POST" })
                  .then(() => refresh())
                  .catch((error) => push({ title: error.message, tone: "danger" }))
              }
            >
              Disconnect
            </Button>
          </div>
        </Card>
      )}
      {!data.github?.connected ? (
        <Button onClick={() => void connect()}>Connect GitHub</Button>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {repos.map((repo) => (
          <Card key={repo.id} className="p-4">
            <p className="font-medium">{repo.fullName}</p>
            <p className="mt-1 text-sm text-muted">{repo.description ?? "No description"}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function GithubPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <GithubInner />
    </Suspense>
  );
}
