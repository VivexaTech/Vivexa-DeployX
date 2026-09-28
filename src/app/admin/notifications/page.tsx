import type { Metadata } from "next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { ActionForm } from "@/components/admin/action-form";
import { broadcastNotificationAction } from "../actions";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/utils";
import type { AuditLog } from "@/types/database";

export const metadata: Metadata = { title: "Notifications" };

export default async function AdminNotificationsPage() {
  await requireAdmin();
  const { data } = await createAdminClient()
    .from("admin_audit_logs")
    .select("*, admin:profiles(email)")
    .eq("action", "NOTIFICATION_BROADCAST")
    .order("created_at", { ascending: false })
    .limit(20);
  const history = (data as unknown as (AuditLog & { admin: { email: string } | null })[]) ?? [];

  return (
    <>
      <PageHeader title="Notifications" description="Send in-app announcements to users." />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card className="h-fit">
          <CardHeader title="Broadcast announcement" description="Delivered to each recipient's notification inbox." />
          <CardContent>
            <ActionForm action={broadcastNotificationAction} submitLabel="Send announcement" resetOnSuccess>
              <div className="space-y-4">
                <Field label="Title" htmlFor="n-title">
                  <Input id="n-title" name="title" required minLength={3} maxLength={120} />
                </Field>
                <Field label="Message" htmlFor="n-body">
                  <Textarea id="n-body" name="body" maxLength={1000} rows={4} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Link (optional)" htmlFor="n-link" hint="Relative path like /dashboard/billing or https URL.">
                    <Input id="n-link" name="link" maxLength={300} />
                  </Field>
                  <Field label="Audience" htmlFor="n-audience">
                    <Select id="n-audience" name="audience" defaultValue="all">
                      <option value="all">All active users</option>
                      <option value="admins">Admins only</option>
                    </Select>
                  </Field>
                </div>
              </div>
            </ActionForm>
          </CardContent>
        </Card>
        <Card className="h-fit overflow-hidden">
          <CardHeader title="Recent broadcasts" />
          {history.length === 0 ? (
            <EmptyState title="No broadcasts yet" className="py-10" />
          ) : (
            <ul className="divide-y divide-border">
              {history.map((h) => {
                const meta = h.metadata as { title?: string; audience?: string; recipients?: number };
                return (
                  <li key={h.id} className="px-5 py-3">
                    <p className="text-[13px] font-medium text-foreground">{meta.title ?? "—"}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {meta.recipients ?? 0} recipients · {meta.audience} · {h.admin?.email ?? "—"} · {formatDate(h.created_at, true)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
