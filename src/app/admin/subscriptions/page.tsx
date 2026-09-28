import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Pagination, TableToolbar } from "@/components/ui/table-toolbar";
import { ActionButton } from "@/components/admin/action-form";
import { updateSubscriptionAction } from "../actions";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/utils";
import { parseListParams, type ListParams } from "@/lib/utils/list";
import type { Subscription } from "@/types/database";

export const metadata: Metadata = { title: "Subscriptions" };

const STATUSES = ["active", "expired", "cancelled", "pending"] as const;

type Row = Subscription & { plan: { name: string } | null; profile: { email: string } | null };

export default async function AdminSubscriptionsPage({ searchParams }: { searchParams: Promise<ListParams> }) {
  await requireAdmin();
  const { page, q, status, from, to, pageSize } = parseListParams(await searchParams, STATUSES);
  const db = createAdminClient();

  let query = db
    .from("subscriptions")
    .select(`*, plan:plans(name), profile:profiles${q ? "!inner" : ""}(email)`, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("profile.email", `%${q}%`);
  const { data, count } = await query;
  const rows = (data as unknown as Row[]) ?? [];

  return (
    <>
      <PageHeader title="Subscriptions" description="Prepaid plan periods across all users." />
      <Card className="overflow-hidden">
        <TableToolbar
          placeholder="Search by email…"
          filters={STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))}
        />
        {rows.length === 0 ? (
          <EmptyState title="No subscriptions found" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>User</TH>
                <TH>Plan</TH>
                <TH>Status</TH>
                <TH>Cycle</TH>
                <TH>Period</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((s) => (
                <TR key={s.id}>
                  <TD>
                    <Link href={`/admin/users/${s.user_id}`} className="hover:underline">
                      {s.profile?.email ?? s.user_id.slice(0, 8)}
                    </Link>
                  </TD>
                  <TD>{s.plan?.name ?? "—"}</TD>
                  <TD>
                    <StatusBadge status={s.status} />
                  </TD>
                  <TD className="capitalize text-muted">{s.billing_cycle}</TD>
                  <TD className="text-muted">
                    {formatDate(s.current_period_start)} → {s.current_period_end ? formatDate(s.current_period_end) : "No expiry"}
                  </TD>
                  <TD className="text-right">
                    {s.status === "active" && (
                      <div className="flex justify-end gap-2">
                        {s.current_period_end && (
                          <ActionButton action={updateSubscriptionAction} fields={{ subscriptionId: s.id, op: "extend", days: "30" }}>
                            +30 days
                          </ActionButton>
                        )}
                        <ActionButton
                          action={updateSubscriptionAction}
                          fields={{ subscriptionId: s.id, op: "cancel" }}
                          variant="ghost"
                          confirm={{
                            title: "Cancel subscription?",
                            description: "The user returns to the default plan immediately. No refund is issued automatically.",
                            confirmLabel: "Cancel subscription",
                            danger: true,
                          }}
                        >
                          Cancel
                        </ActionButton>
                      </div>
                    )}
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
