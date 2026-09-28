"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import type { AdminActionState } from "@/app/admin/actions";

type Action = (prev: AdminActionState, formData: FormData) => Promise<AdminActionState>;

function useFeedback(state: AdminActionState, onSuccess?: () => void) {
  const toast = useToast();
  const last = useRef<AdminActionState>(undefined);
  useEffect(() => {
    if (!state || state === last.current) return;
    last.current = state;
    if (state.error) toast.error("Action failed", state.error);
    else if (state.message) {
      toast.success(state.message);
      if (state.ok) onSuccess?.();
    }
  }, [state, toast, onSuccess]);
}

/** Form bound to an admin server action with inline error and toast feedback. */
export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  className,
  resetOnSuccess,
  onSuccess,
  footerClassName,
}: {
  action: Action;
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
  footerClassName?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useFeedback(state, () => {
    if (resetOnSuccess) formRef.current?.reset();
    onSuccess?.();
  });

  return (
    <form ref={formRef} action={formAction} className={className}>
      {children}
      {state?.error && (
        <Alert tone="danger" className="mt-4">
          {state.error}
        </Alert>
      )}
      <div className={footerClassName ?? "mt-5 flex justify-end"}>
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** Single-button action with hidden fields and optional confirmation dialog. */
export function ActionButton({
  action,
  fields,
  children,
  confirm,
  variant = "outline",
  size = "sm",
  disabled,
}: {
  action: Action;
  fields: Record<string, string>;
  children: React.ReactNode;
  confirm?: { title: string; description?: string; confirmLabel?: string; danger?: boolean };
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [open, setOpen] = useState(false);
  useFeedback(state, () => setOpen(false));

  const submit = () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    startTransition(() => formAction(fd));
  };

  return (
    <>
      <Button variant={variant} size={size} loading={pending && !open} disabled={disabled} onClick={() => (confirm ? setOpen(true) : submit())}>
        {children}
      </Button>
      {confirm && (
        <ConfirmDialog
          open={open}
          onClose={() => setOpen(false)}
          onConfirm={submit}
          loading={pending}
          danger={confirm.danger}
          title={confirm.title}
          description={confirm.description}
          confirmLabel={confirm.confirmLabel}
        />
      )}
    </>
  );
}
