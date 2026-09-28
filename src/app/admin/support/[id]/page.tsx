import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Field, Select, Textarea } from "@/components/ui/input";
import { ActionButton, ActionForm } from "@/components/admin/action-form";
import { adminReplyTicketAction, setTicketStatusAction } from "../../actions";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { cn, formatDate } from "@/lib/utils";
import type { SupportMessage, SupportTicket, TicketStatus } from "@/types/database";

export const metadata: Metadata = { title: "Ticket" };

const STATUS_LABELS: Record<TicketStatus, string> = { open: "Open", in_progress: "In progress", resolved: "Resolved", closed: "Closed" };

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const db = createAdminClient();
  const [{ data: ticketData }, { data: messageData }] = await Promise.all([
    db.from("support_tickets").select("*, profile:profiles(email, name)").eq("id", id).maybeSingle(),
    db.from("support_messages").select("*, author:profiles(name, email)").eq("ticket_id", id).order("created_at"),
  ]);
  if (!ticketData) notFound();
  const ticket = ticketData as unknown as SupportTicket & { profile: { email: string; name: string | null } | null };
  const messages = (messageData as unknown as (SupportMessage & { author: { name: string | null; email: string } | null })[]) ?? [];

  return (
    <>
      <PageHeader
        title={ticket.subject}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={ticket.status} />
            <Badge tone="neutral" className="capitalize">
              {ticket.category}
            </Badge>
            <Badge tone={ticket.priority === "urgent" ? "danger" : ticket.priority === "high" ? "warning" : "neutral"} className="capitalize">
              {ticket.priority}
            </Badge>
            <Link href={`/admin/users/${ticket.user_id}`} className="hover:underline">
              {ticket.profile?.email}
            </Link>
          </span>
        }
        breadcrumb={[{ label: "Support", href: "/admin/support" }, { label: "Ticket" }]}
        actions={(Object.keys(STATUS_LABELS) as TicketStatus[])
          .filter((s) => s !== ticket.status)
          .map((s) => (
            <ActionButton key={s} action={setTicketStatusAction} fields={{ ticketId: ticket.id, status: s }} variant="outline">
              Mark {STATUS_LABELS[s].toLowerCase()}
            </ActionButton>
          ))}
      />
      <div className="mx-auto max-w-3xl space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.is_staff ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] rounded-xl border px-4 py-3", m.is_staff ? "border-accent/25 bg-accent-soft" : "border-border bg-card")}>
              <p className="mb-1 text-xs text-muted">
                {m.is_staff ? `Staff · ${m.author?.name ?? m.author?.email ?? ""}` : (m.author?.name ?? m.author?.email ?? "User")} · {formatDate(m.created_at, true)}
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{m.message}</p>
            </div>
          </div>
        ))}
        <Card>
          <CardHeader title="Reply" description="The user is notified in their dashboard." />
          <CardContent>
            <ActionForm action={adminReplyTicketAction} submitLabel="Send reply" resetOnSuccess>
              <input type="hidden" name="ticketId" value={ticket.id} />
              <Textarea name="message" required rows={5} maxLength={10000} aria-label="Reply message" />
              <Field label="Set status" htmlFor="reply-status" className="mt-4 max-w-56">
                <Select id="reply-status" name="status" defaultValue={ticket.status === "open" ? "in_progress" : ticket.status}>
                  {(Object.keys(STATUS_LABELS) as TicketStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </Field>
            </ActionForm>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
