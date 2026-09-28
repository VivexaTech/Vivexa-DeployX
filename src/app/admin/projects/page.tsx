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
import { getFramework } from "@/lib/frameworks";
import { formatDate, timeAgo } from "@/lib/utils";
import { parseListParams, type ListParams } from "@/lib/utils/list";
import type { Project } from "@/types/database";

export const metadata: Metadata = { title: "Projects" };

type Row = Project & { profile: { email: string } | null };

export default async function AdminProjectsPage({ searchParams }: { searchParams: Promise<ListParams> }) {
  await requireAdmin();
  const { page, q, from, to, pageSize } = parseListParams(await searchParams);
  let query = createAdminClient()
    .from("projects")
    .select("*, profile:profiles(email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (q) query = query.or(`name.ilike.%${q}%,repo_name.ilike.%${q}%,repo_owner.ilike.%${q}%`);
  const { data, count } = await query;
  const rows = (data as unknown as Row[]) ?? [];

  return (
    <>
      <PageHeader title="Projects" description={`${count ?? 0} projects across all users`} />
      <Card className="overflow-hidden">
        <TableToolbar placeholder="Search by project or repository…" />
        {rows.length === 0 ? (
          <EmptyState title="No projects found" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Project</TH>
                <TH>Owner</TH>
                <TH>Framework</TH>
                <TH>Status</TH>
                <TH>Last deploy</TH>
                <TH className="text-right">Created</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <p className="font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted">
                      {p.repo_owner}/{p.repo_name} · {p.branch}
                    </p>
                    {p.production_url && (
                      <a href={p.production_url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">
                        {p.production_url.replace(/^https?:\/\//, "")}
                      </a>
                    )}
                  </TD>
                  <TD>
                    <Link href={`/admin/users/${p.user_id}`} className="hover:underline">
                      {p.profile?.email ?? "—"}
                    </Link>
                  </TD>
                  <TD className="text-muted">{getFramework(p.framework).name}</TD>
                  <TD>
                    <StatusBadge status={p.latest_deployment_status} />
                  </TD>
                  <TD className="text-muted">{p.last_deployed_at ? timeAgo(p.last_deployed_at) : "Never"}</TD>
                  <TD className="text-right text-muted">{formatDate(p.created_at)}</TD>
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
