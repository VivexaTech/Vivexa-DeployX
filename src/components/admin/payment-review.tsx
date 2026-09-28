"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { ActionForm } from "@/components/admin/action-form";
import type { AdminActionState } from "@/app/admin/actions";

type Action = (prev: AdminActionState, formData: FormData) => Promise<AdminActionState>;

export function PaymentReviewButton({
  action,
  paymentId,
  canRefund,
  reviewed,
}: {
  action: Action;
  paymentId: string;
  canRefund: boolean;
  reviewed: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant={reviewed ? "ghost" : "outline"} onClick={() => setOpen(true)}>
        {reviewed ? "Reviewed" : "Review"}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Review payment" description="Reviews are recorded in the audit log.">
        <ActionForm action={action} submitLabel="Save review" onSuccess={() => setOpen(false)}>
          <input type="hidden" name="paymentId" value={paymentId} />
          <Field label="Note" htmlFor="review-note">
            <Textarea id="review-note" name="note" required minLength={3} maxLength={1000} rows={3} />
          </Field>
          {canRefund && (
            <label className="mt-4 flex items-start gap-2 text-[13px] text-foreground">
              <input type="checkbox" name="markRefunded" className="mt-0.5 h-4 w-4" />
              <span>
                Record as refunded
                <span className="block text-xs text-muted">
                  Only records the refund in DeployX. Issue the actual refund from the Razorpay Dashboard first.
                </span>
              </span>
            </label>
          )}
        </ActionForm>
      </Dialog>
    </>
  );
}
