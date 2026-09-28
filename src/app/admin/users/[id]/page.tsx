import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, DescriptionList, PageHeader } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ActionButton, ActionForm } from "@/components/admin/action-form";
import { assignPlanAction, changeRoleAction, setUserStatusAction } from "../../actions";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { canSuspend, isSuperAdmin } from "@/lib/permissions";
import { formatCurrency, formatDate, timeAgo } from "@/lib/utils";
import type { Payment, Plan, Profile, Project, Subscription } from "@/types/database";

export const metadata: Metadata = { title: "User" };

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const db = createAdminClient();

  const { data } = await db.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const user = data as Profile;

  const [subsRes, projectsRes, paymentsRes, plansRes, githubRes] = await Promise.all([
    db.from("subscriptions").select("*, plan:plans(name)").eq("user_id", id).order("created_at", { ascending: false }).limit(20),
    db.from("projects").select("*").eq("user_id", id).order("created_at", { ascending: false }),
    db.from("payments").select("*, plan:plans(name)").eq("user_id", id).order("created_at", { ascending: false }).limit(20),
    db.from("plans").select("id, name, slug").order("display_order"),
    db.from("github_connections").select("username").eq("user_id", id).maybeSingle(),
  ]);
  const subscriptions = (subsRes.data as (Subscription & { plan: { name: string } | null })[]) ?? [];
  const projects = (projectsRes.data as Project[]) ?? [];
  const payments = (paymentsRes.data as (Payment & { plan: { name: string } | null })[]) ?? [];
  const plans = (plansRes.data as Pick<Plan, "id" | "name" | "slug">[]) ?? [];
  const github = githubRes.data as { username: string } | null;
  const active = subscriptions.find((s) => s.status === "active");

  const isSelf = admin.id === user.id;
  const mayChangeRole = isSuperAdmin(admin.profile.role) && !isSelf;
  const maySuspend = canSuspend(admin.profile.role, admin.id, user.id, user.role);

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar name={user.name} email={user.email} src={user.avatar_url} size={36} />
            {user.name ?? user.email}
          </span>
        }
        description={user.email}
        breadcrumb={[{ label: "Users", href: "/admin/users" }, { label: user.email }]}
        actions={
          maySuspend &&
          (user.status === "active" ? (
            <ActionButton
              action={setUserStatusAction}
              fields={{ userId: user.id, status: "suspended" }}
              variant="danger"
              confirm={{
                title: "Suspend this user?",
                description: "They will be signed out of the dashboard and blocked from API access. Their deployed sites are not removed.",
                confirmLabel: "Suspend",
                danger: true,
              }}
            >
              Suspend user
            </ActionButton>
          ) : (
            <ActionButton action={setUserStatusAction} fields={{ userId: user.id, status: "active" }}>
              Reactivate user
            </ActionButton>
          ))
        }
      />

      <div className="space-y-6">
        <Card>
          <CardContent>
            <DescriptionList
              items={[
                { label: "Status", value: <StatusBadge status={user.status} /> },
                { label: "Role", value: <Badge tone={user.role === "user" ? "neutral" : "accent"}>{user.role.replace("_", " ")}</Badge> },
                { label: "Current plan", value: active?.plan?.name ?? "Default plan" },
                { label: "Plan valid until", value: active?.current_period_end ? formatDate(active.current_period_end) : "No expiry" },
                { label: "GitHub", value: github ? `@${github.username}` : "Not connected" },
                { label: "Joined", value: formatDate(user.created_at, true) },
              ]}
            />
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Role" description={mayChangeRole ? "Only super admins can change roles." : isSelf ? "You cannot change your own role." : "Only super admins can change roles."} />
            <CardContent>
              {mayChangeRole ? (
                <ActionForm action={changeRoleAction} submitLabel="Update role">
                  <input type="hidden" name="userId" value={user.id} />
                  <Field label="Role" htmlFor="role">
                    <Select id="role" name="role" defaultValue={user.role}>
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super admin</option>
                    </Select>
                  </Field>
                </ActionForm>
              ) : (
                <p className="text-[13px] text-muted">Current role: {user.role.replace("_", " ")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Assign plan" description="Manually grant a plan (e.g. offline invoice). No payment is recorded." />
            <CardContent>
              <ActionForm action={assignPlanAction} submitLabel="Assign plan" resetOnSuccess>
                <input type="hidden" name="userId" value={user.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Plan" htmlFor="planId">
                    <Select id="planId" name="planId" defaultValue={active?.plan_id ?? plans[0]?.id}>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Period" htmlFor="cycle">
                    <Select id="cycle" name="cycle" defaultValue="monthly">
                      <option value="monthly">1 month</option>
                      <option value="yearly">1 year</option>
                      <option value="free">No expiry</option>
                    </Select>
                  </Field>
                </div>
                <Field label="Reason (audit log)" htmlFor="note" className="mt-4">
                  <Input id="note" name="note" required minLength={3} maxLength={500} placeholder="e.g. Invoice #1042 paid by bank transfer" />
                </Field>
              </ActionForm>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader title="Subscriptions" />
          {subscriptions.length === 0 ? (
            <EmptyState title="No subscriptions" className="py-10" />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Plan</TH>
                  <TH>Status</TH>
                  <TH>Cycle</TH>
                  <TH>Started</TH>
                  <TH>Ends</TH>
                </tr>
              </THead>
              <TBody>
                {subscriptions.map((s) => (
                  <TR key={s.id}>
                    <TD>{s.plan?.name ?? "—"}</TD>
                    <TD>
                      <StatusBadge status={s.status} />
                    </TD>
                    <TD className="capitalize text-muted">{s.billing_cycle}</TD>
                    <TD className="text-muted">{formatDate(s.current_period_start)}</TD>
                    <TD className="text-muted">{s.current_period_end ? formatDate(s.current_period_end) : "No expiry"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <CardHeader title={`Projects (${projects.length})`} />
            {projects.length === 0 ? (
              <EmptyState title="No projects" className="py-10" />
            ) : (
              <ul className="divide-y divide-border">
                {projects.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-foreground">{p.name}</p>
                      <p className="truncate text-xs text-muted">
                        {p.repo_owner}/{p.repo_name}
                      </p>
                    </div>
                    <StatusBadge status={p.latest_deployment_status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="overflow-hidden">
            <CardHeader
              title="Payments"
              action={
                <Link href={`/admin/payments?q=${encodeURIComponent(user.email)}`} className="text-xs text-muted hover:text-foreground">
                  View in payments
                </Link>
              }
            />
            {payments.length === 0 ? (
              <EmptyState title="No payments" className="py-10" />
            ) : (
              <ul className="divide-y divide-border">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-[13px] text-foreground">
                        {p.plan?.name ?? "—"} · <span className="capitalize">{p.billing_cycle}</span>
                      </p>
                      <p className="text-xs text-muted">{timeAgo(p.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[13px] font-medium">{formatCurrency(p.amount, p.currency)}</span>
                      <StatusBadge status={p.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
