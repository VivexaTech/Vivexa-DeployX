import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Pagination, TableToolbar } from "@/components/ui/table-toolbar";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/utils";
import { parseListParams, type ListParams } from "@/lib/utils/list";
import type { AuditLog } from "@/types/database";

export const metadata: Metadata = { title: "Audit Logs" };

const ACTION_FILTERS = [
  "PLAN_UPDATED",
  "USER_SUSPENDED",
  "ROLE_CHANGED",
  "PAYMENT_REVIEWED",
  "SUBSCRIPTION_UPDATED",
  "SETTINGS_UPDATED",
] as const;

type Row = AuditLog & { admin: { email: string } | null };

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<ListParams> }) {
  await requireAdmin();
  const { page, q, status, from, to, pageSize } = parseListParams(await searchParams, ACTION_FILTERS);
  let query = createAdminClient()
    .from("admin_audit_logs")
    .select("*, admin:profiles(email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (status) query = query.eq("action", status);
  if (q) query = query.or(`action.ilike.%${q}%,resource_type.ilike.%${q}%,resource_id.ilike.%${q}%`);
  const { data, count } = await query;
  const rows = (data as unknown as Row[]) ?? [];

  return (
    <>
      <PageHeader title="Audit Logs" description="Every administrative change, newest first." />
      <Card className="overflow-hidden">
        <TableToolbar placeholder="Search action, resource or ID…" filters={ACTION_FILTERS.map((a) => ({ value: a, label: a }))} />
        {rows.length === 0 ? (
          <EmptyState title="No audit entries" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Time</TH>
                <TH>Admin</TH>
                <TH>Action</TH>
                <TH>Resource</TH>
                <TH>Details</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((log) => (
                <TR key={log.id}>
                  <TD className="whitespace-nowrap text-muted">{formatDate(log.created_at, true)}</TD>
                  <TD>{log.admin?.email ?? "System"}</TD>
                  <TD>
                    <Badge tone="accent" className="font-mono text-[11px]">
                      {log.action}
                    </Badge>
                  </TD>
                  <TD className="text-xs text-muted">
                    {log.resource_type}
                    {log.resource_id && <span className="block font-mono">{log.resource_id.slice(0, 13)}</span>}
                  </TD>
                  <TD>
                    <details className="max-w-md">
                      <summary className="cursor-pointer text-xs text-muted hover:text-foreground">View</summary>
                      <pre className="scrollbar-thin mt-2 max-h-60 overflow-auto rounded-md bg-background-subtle p-2 font-mono text-[11px] whitespace-pre-wrap">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </details>
                  </TD>
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
