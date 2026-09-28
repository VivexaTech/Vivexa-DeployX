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
import { timeAgo } from "@/lib/utils";
import { parseListParams, type ListParams } from "@/lib/utils/list";
import type { SupportTicket } from "@/types/database";

export const metadata: Metadata = { title: "Support" };

const STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
const PRIORITY_TONE = { low: "neutral", normal: "neutral", high: "warning", urgent: "danger" } as const;

type Row = SupportTicket & { profile: { email: string } | null };

export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<ListParams> }) {
  await requireAdmin();
  const { page, q, status, from, to, pageSize } = parseListParams(await searchParams, STATUSES);
  let query = createAdminClient()
    .from("support_tickets")
    .select("*, profile:profiles(email)", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(from, to);
  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("subject", `%${q}%`);
  const { data, count } = await query;
  const rows = (data as unknown as Row[]) ?? [];

  return (
    <>
      <PageHeader title="Support" description="Customer tickets and conversations." />
      <Card className="overflow-hidden">
        <TableToolbar
          placeholder="Search subjects…"
          filters={[
            { value: "open", label: "Open" },
            { value: "in_progress", label: "In progress" },
            { value: "resolved", label: "Resolved" },
            { value: "closed", label: "Closed" },
          ]}
        />
        {rows.length === 0 ? (
          <EmptyState title="No tickets found" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Subject</TH>
                <TH>User</TH>
                <TH>Category</TH>
                <TH>Priority</TH>
                <TH>Status</TH>
                <TH className="text-right">Updated</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((t) => (
                <TR key={t.id} className="relative">
                  <TD>
                    <Link href={`/admin/support/${t.id}`} className="font-medium text-foreground after:absolute after:inset-0 hover:underline">
                      {t.subject}
                    </Link>
                  </TD>
                  <TD className="text-muted">{t.profile?.email ?? "—"}</TD>
                  <TD className="capitalize text-muted">{t.category}</TD>
                  <TD>
                    <Badge tone={PRIORITY_TONE[t.priority]} className="capitalize">
                      {t.priority}
                    </Badge>
                  </TD>
                  <TD>
                    <StatusBadge status={t.status} />
                  </TD>
                  <TD className="text-right text-muted">{timeAgo(t.updated_at)}</TD>
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
