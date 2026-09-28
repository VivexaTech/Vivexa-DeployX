import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Pagination, TableToolbar } from "@/components/ui/table-toolbar";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDuration, shortSha, timeAgo } from "@/lib/utils";
import { parseListParams, type ListParams } from "@/lib/utils/list";
import type { Deployment } from "@/types/database";

export const metadata: Metadata = { title: "Deployments" };

const STATUSES = ["ready", "building", "queued", "error", "cancelled"] as const;

type Row = Deployment & { project: { name: string } | null; profile: { email: string } | null };

export default async function AdminDeploymentsPage({ searchParams }: { searchParams: Promise<ListParams> }) {
  await requireAdmin();
  const { page, q, status, from, to, pageSize } = parseListParams(await searchParams, STATUSES);
  let query = createAdminClient()
    .from("deployments")
    .select(`*, project:projects${q ? "!inner" : ""}(name), profile:profiles(email)`, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("project.name", `%${q}%`);
  const { data, count } = await query;
  const rows = (data as unknown as Row[]) ?? [];

  return (
    <>
      <PageHeader title="Deployments" description="All deployments across the platform." />
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
        {rows.length === 0 ? (
          <EmptyState title="No deployments found" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Project</TH>
                <TH>User</TH>
                <TH>Status</TH>
                <TH>Commit</TH>
                <TH>Duration</TH>
                <TH className="text-right">Created</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((d) => (
                <TR key={d.id}>
                  <TD>
                    <p className="font-medium text-foreground">{d.project?.name ?? "—"}</p>
                    {d.error_message && (
                      <p className="max-w-64 truncate text-xs text-danger" title={d.error_message}>
                        {d.error_message}
                      </p>
                    )}
                  </TD>
                  <TD>
                    <Link href={`/admin/users/${d.user_id}`} className="hover:underline">
                      {d.profile?.email ?? "—"}
                    </Link>
                  </TD>
                  <TD>
                    <StatusBadge status={d.status} />
                  </TD>
                  <TD className="max-w-60">
                    <span className="font-mono text-xs">{shortSha(d.commit_sha)}</span>{" "}
                    <span className="truncate text-xs text-muted">{d.commit_message}</span>
                  </TD>
                  <TD className="text-muted">{formatDuration(d.build_started_at ?? d.created_at, d.ready_at)}</TD>
                  <TD className="text-right text-muted">{timeAgo(d.created_at)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <Pagination page={page} pageSize={pageSize} total={count ?? 0} />
      </Card>
    </>
  );
}
