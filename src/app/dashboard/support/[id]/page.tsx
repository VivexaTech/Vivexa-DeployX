import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, PageHeader } from "@/components/ui/misc";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { ReplyForm } from "@/components/support/support-forms";
import { replyTicketAction } from "../actions";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDate } from "@/lib/utils";
import type { SupportMessage, SupportTicket } from "@/types/database";

export const metadata: Metadata = { title: "Support Ticket" };

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: ticketData }, { data: messageData }] = await Promise.all([
    supabase.from("support_tickets").select("*").eq("id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("support_messages").select("*").eq("ticket_id", id).order("created_at"),
  ]);
  if (!ticketData) notFound();
  const ticket = ticketData as SupportTicket;
  const messages = (messageData as SupportMessage[]) ?? [];

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
            <span>Opened {formatDate(ticket.created_at, true)}</span>
          </span>
        }
        breadcrumb={[{ label: "Support", href: "/dashboard/support" }, { label: "Ticket" }]}
      />
      <div className="mx-auto max-w-3xl space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex gap-3", m.is_staff ? "" : "flex-row-reverse")}>
            {m.is_staff ? (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">DX</span>
            ) : (
              <Avatar name={user.profile.name} email={user.email} src={user.profile.avatar_url} />
            )}
            <div className={cn("max-w-[80%] rounded-xl border px-4 py-3", m.is_staff ? "border-accent/25 bg-accent-soft" : "border-border bg-card")}>
              <p className="mb-1 text-xs text-muted">
                {m.is_staff ? "Support team" : "You"} · {formatDate(m.created_at, true)}
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{m.message}</p>
            </div>
          </div>
        ))}
        <Card>
          <CardContent>
            <ReplyForm action={replyTicketAction} ticketId={ticket.id} disabled={ticket.status === "closed"} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
