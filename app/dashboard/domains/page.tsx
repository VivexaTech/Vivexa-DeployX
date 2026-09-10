"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, statusTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import type { Project, ProjectDomain } from "@/types";

export default function DomainsPage() {
  const [rows, setRows] = useState<{ project: Project; domains: ProjectDomain[] }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ projects: Project[] }>("/api/projects")
      .then(async ({ projects }) => {
        const details = await Promise.all(
          projects.map((project) =>
            apiFetch<{ project: Project; domains: ProjectDomain[] }>(`/api/projects/${project.projectId}`),
          ),
        );
        setRows(details);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-64" />;
  const hasDomains = rows.some((row) => row.domains.length > 0);

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-semibold">Domains</h1>
      {!hasDomains ? (
        <EmptyState
          title="No domains connected"
          description="Assign a vivexatech.in subdomain or connect a domain from any registrar on a project page."
          actionHref="/dashboard/projects"
          actionLabel="Open projects"
        />
      ) : (
        rows.flatMap((row) =>
          row.domains.map((domain) => (
            <Card key={domain.domainId} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{domain.domain}</p>
                  <p className="text-sm text-muted">{row.project.name}</p>
                </div>
                <Badge tone={statusTone(domain.status)}>{domain.status}</Badge>
              </div>
              <Link href={`/dashboard/projects/${row.project.projectId}`} className="mt-3 inline-block text-sm text-accent">
                Manage DNS
              </Link>
            </Card>
          )),
        )
      )}
    </div>
  );
}
