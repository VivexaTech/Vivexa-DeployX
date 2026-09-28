import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Avatar, PageHeader } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Pagination, TableToolbar } from "@/components/ui/table-toolbar";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/utils";
import { parseListParams, type ListParams } from "@/lib/utils/list";
import type { Profile } from "@/types/database";

export const metadata: Metadata = { title: "Users" };

const FILTERS = ["active", "suspended", "admin", "super_admin"] as const;

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<ListParams> }) {
  await requireAdmin();
  const { page, q, status, from, to, pageSize } = parseListParams(await searchParams, FILTERS);
  const db = createAdminClient();

  let query = db.from("profiles").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  if (q) query = query.or(`email.ilike.%${q}%,name.ilike.%${q}%`);
  if (status === "active" || status === "suspended") query = query.eq("status", status);
  if (status === "admin" || status === "super_admin") query = query.eq("role", status);
  const { data, count } = await query;
  const users = (data as Profile[]) ?? [];

  const ids = users.map((u) => u.id);
  const { data: subs } = ids.length
    ? await db.from("subscriptions").select("user_id, plan:plans(name)").eq("status", "active").in("user_id", ids)
    : { data: [] };
  const planByUser = new Map(((subs as unknown as { user_id: string; plan: { name: string } | null }[]) ?? []).map((s) => [s.user_id, s.plan?.name]));

  return (
    <>
      <PageHeader title="Users" description={`${count ?? 0} registered accounts`} />
      <Card className="overflow-hidden">
        <TableToolbar
          placeholder="Search by name or email…"
          filters={[
            { value: "active", label: "Active" },
            { value: "suspended", label: "Suspended" },
            { value: "admin", label: "Admins" },
            { value: "super_admin", label: "Super admins" },
          ]}
        />
        {users.length === 0 ? (
          <EmptyState title="No users found" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>User</TH>
                <TH>Role</TH>
                <TH>Plan</TH>
                <TH>Status</TH>
                <TH className="text-right">Joined</TH>
              </tr>
            </THead>
            <TBody>
              {users.map((u) => (
                <TR key={u.id} className="relative">
                  <TD>
                    <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                      <Avatar name={u.name} email={u.email} src={u.avatar_url} size={28} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground">{u.name ?? "—"}</span>
                        <span className="block truncate text-xs text-muted">{u.email}</span>
                      </span>
                    </Link>
                  </TD>
                  <TD>
                    <Badge tone={u.role === "user" ? "neutral" : "accent"}>{u.role.replace("_", " ")}</Badge>
                  </TD>
                  <TD className="text-muted">{planByUser.get(u.id) ?? "Default"}</TD>
                  <TD>
                    <StatusBadge status={u.status} />
                  </TD>
                  <TD className="text-right text-muted">{formatDate(u.created_at)}</TD>
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
