import type { Metadata } from "next";
import { Plus, Rocket } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { Pagination, TableToolbar } from "@/components/ui/table-toolbar";
import { DeploymentsTable, type DeploymentWithProject } from "@/components/deployment/deployments-table";
import { DeploymentCard } from "@/components/deployment/deployment-card";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { DeploymentStatus } from "@/types/database";

export const metadata: Metadata = { title: "Deployments" };

const PAGE_SIZE = 25;
const STATUSES: DeploymentStatus[] = ["ready", "building", "queued", "error", "cancelled"];

export default async function DeploymentsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string; q?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const page = Math.max(0, Number.parseInt(params.page ?? "0", 10) || 0);
  const status = STATUSES.find((s) => s === params.status);
  const supabase = await createClient();

  let query = supabase
    .from("deployments")
    .select("*, project:projects!inner(id, name)", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  const search = params.q?.trim().replace(/[%,()]/g, "");
  if (search) query = query.ilike("project.name", `%${search}%`);

  const { data, count } = await query;
  const deployments = (data as DeploymentWithProject[]) ?? [];

  return (
    <>
      <PageHeader title="Deployments" description="Every build across all of your projects." />
      <Card className="overflow-hidden">
        <TableToolbar
          placeholder="Filter by project…"
          filters={[
            { value: "ready", label: "Ready" },
            { value: "building", label: "Building" },
            { value: "queued", label: "Queued" },
            { value: "error", label: "Error" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
        {deployments.length === 0 ? (
          <EmptyState
            icon={<Rocket className="h-5 w-5" />}
            title={status || search ? "No matching deployments" : "No deployments yet"}
            description={status || search ? "Try a different filter." : "Create a project to trigger your first deployment."}
            action={
              !status &&
              !search && (
                <ButtonLink href="/dashboard/projects/new" size="sm">
                  <Plus className="h-4 w-4" /> New Project
                </ButtonLink>
              )
            }
          />
        ) : (
          <>
            <div className="hidden md:block">
              <DeploymentsTable deployments={deployments} />
            </div>
            <div className="space-y-2 p-3 md:hidden">
              {deployments.map((d) => (
                <DeploymentCard key={d.id} deployment={d} projectName={d.project?.name} />
              ))}
            </div>
          </>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
      </Card>
    </>
  );
}
