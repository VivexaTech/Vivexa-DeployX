import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { NewTicketForm } from "@/components/support/support-forms";
import { createTicketAction } from "./actions";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getPlatformSettings } from "@/lib/data/settings";
import { timeAgo } from "@/lib/utils";
import type { SupportTicket } from "@/types/database";

export const metadata: Metadata = { title: "Support" };

export default async function SupportPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data }, settings] = await Promise.all([
    supabase.from("support_tickets").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
    getPlatformSettings(),
  ]);
  const tickets = (data as SupportTicket[]) ?? [];

  return (
    <>
      <PageHeader title="Support" description={`Get help from the ${settings.platform_name} team.`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <Card className="h-fit overflow-hidden">
          <CardHeader title="Your tickets" />
          {tickets.length === 0 ? (
            <EmptyState icon={<LifeBuoy className="h-5 w-5" />} title="No tickets yet" description="Create a ticket and our team will get back to you." />
          ) : (
            <ul className="divide-y divide-border">
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link href={`/dashboard/support/${t.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-background-subtle">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{t.subject}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        <span className="capitalize">{t.category}</span> · Updated {timeAgo(t.updated_at)}
                      </p>
                    </div>
                    {(t.priority === "high" || t.priority === "urgent") && (
                      <Badge tone={t.priority === "urgent" ? "danger" : "warning"} className="capitalize">
                        {t.priority}
                      </Badge>
                    )}
                    <StatusBadge status={t.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="h-fit">
          <CardHeader title="New ticket" description={settings.support_email ? `You can also email ${settings.support_email}.` : undefined} />
          <CardContent>
            <NewTicketForm action={createTicketAction} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
