"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/states";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import type { SettingsFormState } from "@/app/dashboard/settings/actions";

type Action = (prev: SettingsFormState, formData: FormData) => Promise<SettingsFormState>;

export function ProfileForm({ action, name, avatarUrl, email }: { action: Action; name: string; avatarUrl: string; email: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      <Field label="Email" htmlFor="email" hint="Contact support to change your email address.">
        <Input id="email" value={email} disabled readOnly />
      </Field>
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" defaultValue={name} required minLength={2} maxLength={80} />
      </Field>
      <Field label="Avatar URL" htmlFor="avatarUrl" hint="Optional. Must be an https:// image URL.">
        <Input id="avatarUrl" name="avatarUrl" defaultValue={avatarUrl} placeholder="https://…" type="url" />
      </Field>
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      {state?.message && <Alert tone="success">{state.message}</Alert>}
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          Save profile
        </Button>
      </div>
    </form>
  );
}

export function PasswordForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.message) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <Field label="Current password" htmlFor="current">
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm">
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
        </Field>
      </div>
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      {state?.message && <Alert tone="success">{state.message}</Alert>}
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          Update password
        </Button>
      </div>
    </form>
  );
}

export function GithubDisconnectButton() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const disconnect = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/github/disconnect", { method: "POST" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not disconnect GitHub");
      toast.success("GitHub disconnected");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error("Could not disconnect", error instanceof Error ? error.message : undefined);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Disconnect
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={disconnect}
        loading={loading}
        danger
        title="Disconnect GitHub?"
        description="Existing projects stay online, but new deployments will fail until you reconnect GitHub."
        confirmLabel="Disconnect"
      />
    </>
  );
}
