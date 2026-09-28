"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { ActionForm } from "@/components/admin/action-form";
import type { AdminActionState } from "@/app/admin/actions";
import type { Coupon } from "@/types/database";

type Action = (prev: AdminActionState, formData: FormData) => Promise<AdminActionState>;

export function CouponEditor({ action, coupon }: { action: Action; coupon?: Coupon }) {
  const [open, setOpen] = useState(false);
  const value = coupon ? (coupon.discount_type === "fixed" ? coupon.discount_value / 100 : coupon.discount_value) : "";
  return (
    <>
      {coupon ? (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} aria-label={`Edit ${coupon.code}`}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New coupon
        </Button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={coupon ? `Edit ${coupon.code}` : "New coupon"}>
        <ActionForm action={action} submitLabel={coupon ? "Save coupon" : "Create coupon"} onSuccess={() => setOpen(false)}>
          <input type="hidden" name="id" value={coupon?.id ?? ""} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Code" htmlFor="c-code">
              <Input id="c-code" name="code" defaultValue={coupon?.code} required className="font-mono uppercase" maxLength={40} />
            </Field>
            <Field label="Description" htmlFor="c-desc">
              <Input id="c-desc" name="description" defaultValue={coupon?.description ?? ""} maxLength={200} />
            </Field>
            <Field label="Discount type" htmlFor="c-type">
              <Select id="c-type" name="discountType" defaultValue={coupon?.discount_type ?? "percent"}>
                <option value="percent">Percent (%)</option>
                <option value="fixed">Fixed amount (₹)</option>
              </Select>
            </Field>
            <Field label="Discount value" htmlFor="c-value">
              <Input id="c-value" name="discountValue" type="number" min={0.01} step="0.01" defaultValue={value} required />
            </Field>
            <Field label="Max redemptions" htmlFor="c-max" hint="Empty = unlimited">
              <Input id="c-max" name="maxRedemptions" type="number" min={0} defaultValue={coupon?.max_redemptions ?? ""} />
            </Field>
            <Field label="Valid until" htmlFor="c-until" hint="Empty = no expiry">
              <Input id="c-until" name="validUntil" type="date" defaultValue={coupon?.valid_until?.slice(0, 10) ?? ""} />
            </Field>
          </div>
          <label className="mt-4 flex items-center gap-2 text-[13px] text-foreground">
            <input type="checkbox" name="isActive" defaultChecked={coupon?.is_active ?? true} className="h-4 w-4" /> Active
          </label>
        </ActionForm>
      </Dialog>
    </>
  );
}
