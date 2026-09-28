import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Pagination, TableToolbar } from "@/components/ui/table-toolbar";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, timeAgo } from "@/lib/utils";
import { parseListParams, type ListParams } from "@/lib/utils/list";
import type { Domain } from "@/types/database";

export const metadata: Metadata = { title: "Domains" };

const STATUSES = ["verified", "pending", "verifying", "invalid"] as const;

type Row = Domain & { project: { name: string } | null; profile: { email: string } | null };

export default async function AdminDomainsPage({ searchParams }: { searchParams: Promise<ListParams> }) {
  await requireAdmin();
  const { page, q, status, from, to, pageSize } = parseListParams(await searchParams, STATUSES);
  let query = createAdminClient()
    .from("domains")
    .select("*, project:projects(name), profile:profiles(email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("name", `%${q}%`);
  const { data, count } = await query;
  const rows = (data as unknown as Row[]) ?? [];

  return (
    <>
      <PageHeader title="Domains" description="Subdomains and custom domains connected to projects." />
      <Card className="overflow-hidden">
        <TableToolbar
          placeholder="Search domains…"
          filters={STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))}
        />
        {rows.length === 0 ? (
          <EmptyState title="No domains found" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Domain</TH>
                <TH>Type</TH>
                <TH>Project</TH>
                <TH>User</TH>
                <TH>Status</TH>
                <TH>Last checked</TH>
                <TH className="text-right">Added</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((d) => (
                <TR key={d.id}>
                  <TD className="font-medium text-foreground">{d.name}</TD>
                  <TD>
                    <Badge tone="neutral">{d.type === "subdomain" ? "Subdomain" : "Custom"}</Badge>
                  </TD>
                  <TD className="text-muted">{d.project?.name ?? "—"}</TD>
                  <TD>
                    <Link href={`/admin/users/${d.user_id}`} className="hover:underline">
                      {d.profile?.email ?? "—"}
                    </Link>
                  </TD>
                  <TD>
                    <StatusBadge status={d.status} />
                  </TD>
                  <TD className="text-muted">{timeAgo(d.last_checked_at)}</TD>
                  <TD className="text-right text-muted">{formatDate(d.created_at)}</TD>
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
