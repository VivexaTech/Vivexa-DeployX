"use client";

import { useState, useTransition } from "react";
import { Check, CheckCircle2, Pencil, Plus, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { ActionForm } from "@/components/admin/action-form";
import type { AdminActionState } from "@/app/admin/actions";
import type { VercelAccount } from "@/types/database";

type Action = (prev: AdminActionState, formData: FormData) => Promise<AdminActionState>;

export function VercelAccountDialog({
  saveAction,
  testAction,
  account,
}: {
  saveAction: Action;
  testAction: Action;
  account?: VercelAccount;
}) {
  const [open, setOpen] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, startTesting] = useTransition();

  const handleTest = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const form = e.currentTarget.closest("form");
    if (!form) return;
    const formData = new FormData(form);

    startTesting(async () => {
      setTestResult(null);
      const res = await testAction(undefined, formData);
      if (res?.error) {
        setTestResult({ ok: false, message: res.error });
      } else if (res?.message) {
        setTestResult({ ok: true, message: res.message });
      }
    });
  };

  return (
    <>
      {account ? (
        <Button size="sm" variant="outline" onClick={() => { setTestResult(null); setOpen(true); }} aria-label={`Edit ${account.name}`}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <Button onClick={() => { setTestResult(null); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Add Vercel account
        </Button>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={account ? `Edit ${account.name}` : "Connect new Vercel account"}
        description="Add a Vercel account and team credentials to prevent hitting single-account resource limits. You can assign users and projects to this account."
      >
        <ActionForm
          action={saveAction}
          submitLabel={account ? "Save changes" : "Add account"}
          onSuccess={() => setOpen(false)}
        >
          <input type="hidden" name="id" value={account?.id ?? ""} />

          <div className="space-y-4">
            <Field label="Account name / Label" htmlFor="va-name" hint="e.g. Primary Production, Enterprise Team 1, Client X Vercel">
              <Input
                id="va-name"
                name="name"
                defaultValue={account?.name ?? ""}
                required
                placeholder="Production Vercel Team"
                maxLength={80}
              />
            </Field>

            <Field
              label="Vercel API Token"
              htmlFor="va-token"
              hint={account ? "Leave empty to retain existing encrypted token" : "Access token created at vercel.com/account/tokens"}
            >
              <Input
                id="va-token"
                name="token"
                type="password"
                required={!account}
                placeholder={account ? "••••••••••••••••••••••••••••••••" : "Bearer token..."}
                autoComplete="off"
              />
            </Field>

            <Field
              label="Vercel Team ID / Slug"
              htmlFor="va-team"
              hint="Leave blank if using a personal Vercel account without a team"
            >
              <Input
                id="va-team"
                name="teamId"
                defaultValue={account?.team_id ?? ""}
                placeholder="team_abc12345 (or team slug)"
                maxLength={80}
              />
            </Field>

            <Field label="Notes" htmlFor="va-notes" hint="Optional description or quota notes">
              <Input
                id="va-notes"
                name="notes"
                defaultValue={account?.notes ?? ""}
                placeholder="e.g. Assigned to enterprise client tiers"
                maxLength={500}
              />
            </Field>

            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:gap-6">
              <label className="flex items-center gap-2 text-[13px] text-foreground">
                <input
                  type="checkbox"
                  name="isDefault"
                  defaultChecked={account?.is_default ?? false}
                  className="h-4 w-4"
                />
                Platform default fallback
              </label>

              <label className="flex items-center gap-2 text-[13px] text-foreground">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={account?.is_active ?? true}
                  className="h-4 w-4"
                />
                Active
              </label>
            </div>

            <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted">Verify Vercel credentials before saving</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  loading={testing}
                  onClick={handleTest}
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> Test connection
                </Button>
              </div>

              {testResult && (
                <div
                  className={`mt-2.5 flex items-start gap-2 rounded p-2 text-xs ${
                    testResult.ok
                      ? "border border-green-500/20 bg-green-500/10 text-green-700 dark:text-green-300"
                      : "border border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300"
                  }`}
                >
                  {testResult.ok ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>
          </div>
        </ActionForm>
      </Dialog>
    </>
  );
}
