"use client";

import { useActionState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/states";
import type { SupportFormState } from "@/app/dashboard/support/actions";

type Action = (prev: SupportFormState, formData: FormData) => Promise<SupportFormState>;

export function NewTicketForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      <Field label="Subject" htmlFor="subject">
        <Input id="subject" name="subject" required minLength={3} maxLength={200} placeholder="Briefly describe the issue" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" htmlFor="category">
          <Select id="category" name="category" defaultValue="general">
            <option value="general">General</option>
            <option value="billing">Billing</option>
            <option value="deployments">Deployments</option>
            <option value="domains">Domains</option>
            <option value="account">Account</option>
            <option value="bug">Bug report</option>
          </Select>
        </Field>
        <Field label="Priority" htmlFor="priority">
          <Select id="priority" name="priority" defaultValue="normal">
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
        </Field>
      </div>
      <Field label="Message" htmlFor="message" hint="Include project names, deployment IDs or order IDs where relevant. Never share passwords or secret keys.">
        <Textarea id="message" name="message" required minLength={10} maxLength={10000} rows={6} />
      </Field>
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          Create ticket
        </Button>
      </div>
    </form>
  );
}

export function ReplyForm({ action, ticketId, disabled }: { action: Action; ticketId: string; disabled?: boolean }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <Textarea name="message" required maxLength={10000} rows={4} placeholder={disabled ? "This ticket is closed." : "Write a reply…"} disabled={disabled} aria-label="Reply" />
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      <div className="flex justify-end">
        <Button type="submit" loading={pending} disabled={disabled}>
          {!pending && <Send className="h-4 w-4" />} Send
        </Button>
      </div>
    </form>
  );
}
