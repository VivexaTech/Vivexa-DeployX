"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/security/rate-limit";

export type SupportFormState = { error?: string; ok?: boolean } | undefined;

const ticketSchema = z.object({
  subject: z.string().trim().min(3, "Subject must be at least 3 characters").max(200),
  category: z.enum(["general", "billing", "deployments", "domains", "account", "bug"]),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  message: z.string().trim().min(10, "Please describe the issue in at least 10 characters").max(10_000),
});

export async function createTicketAction(_prev: SupportFormState, formData: FormData): Promise<SupportFormState> {
  const user = await requireUser();
  if (!rateLimit(`ticket:${user.id}`, 5, 10 * 60_000).ok) {
    return { error: "You're creating tickets too quickly. Please wait a few minutes." };
  }
  const parsed = ticketSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("support_tickets")
    .insert({
      user_id: user.id,
      subject: parsed.data.subject,
      category: parsed.data.category,
      priority: parsed.data.priority,
      status: "open",
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Could not create the ticket. Please try again." };

  const ticketId = (data as { id: string }).id;
  const { error: messageError } = await supabase
    .from("support_messages")
    .insert({ ticket_id: ticketId, author_id: user.id, message: parsed.data.message, is_staff: false });
  if (messageError) return { error: "The ticket was created but the message could not be saved." };

  revalidatePath("/dashboard/support");
  redirect(`/dashboard/support/${ticketId}`);
}

const replySchema = z.object({
  ticketId: z.string().uuid(),
  message: z.string().trim().min(1, "Message cannot be empty").max(10_000),
});

export async function replyTicketAction(_prev: SupportFormState, formData: FormData): Promise<SupportFormState> {
  const user = await requireUser();
  if (!rateLimit(`ticket-reply:${user.id}`, 20, 10 * 60_000).ok) {
    return { error: "You're sending messages too quickly. Please wait a moment." };
  }
  const parsed = replySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, status")
    .eq("id", parsed.data.ticketId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!ticket) return { error: "Ticket not found." };
  if ((ticket as { status: string }).status === "closed") return { error: "This ticket is closed. Please open a new ticket." };

  const { error } = await supabase
    .from("support_messages")
    .insert({ ticket_id: parsed.data.ticketId, author_id: user.id, message: parsed.data.message, is_staff: false });
  if (error) return { error: "Could not send your message." };

  if ((ticket as { status: string }).status === "resolved") {
    await createAdminClient().from("support_tickets").update({ status: "open" }).eq("id", parsed.data.ticketId);
  } else {
    await createAdminClient().from("support_tickets").update({ updated_at: new Date().toISOString() }).eq("id", parsed.data.ticketId);
  }

  revalidatePath(`/dashboard/support/${parsed.data.ticketId}`);
  return { ok: true };
}
