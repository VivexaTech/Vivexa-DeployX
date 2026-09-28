"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { ActionForm } from "@/components/admin/action-form";
import type { AdminActionState } from "@/app/admin/actions";
import type { Plan } from "@/types/database";

type Action = (prev: AdminActionState, formData: FormData) => Promise<AdminActionState>;

function rupees(paise: number | undefined) {
  return paise === undefined ? "" : String(paise / 100);
}

function limit(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

export function PlanEditor({ action, plan }: { action: Action; plan?: Plan }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {plan ? (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New plan
        </Button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={plan ? `Edit ${plan.name}` : "New plan"} size="lg">
        <ActionForm action={action} submitLabel={plan ? "Save plan" : "Create plan"} onSuccess={() => setOpen(false)}>
          <input type="hidden" name="id" value={plan?.id ?? ""} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="p-name">
              <Input id="p-name" name="name" defaultValue={plan?.name} required maxLength={60} />
            </Field>
            <Field label="Slug" htmlFor="p-slug" hint="Used in URLs; changing it breaks existing pricing links.">
              <Input id="p-slug" name="slug" defaultValue={plan?.slug} required pattern="[a-z0-9-]{2,40}" />
            </Field>
            <Field label="Description" htmlFor="p-desc" className="sm:col-span-2">
              <Input id="p-desc" name="description" defaultValue={plan?.description} maxLength={300} />
            </Field>
            <Field label="Monthly price (₹)" htmlFor="p-monthly" hint="0 for free.">
              <Input id="p-monthly" name="priceMonthly" type="number" min={0} step="0.01" defaultValue={rupees(plan?.price_monthly) || "0"} />
            </Field>
            <Field label="Yearly price (₹)" htmlFor="p-yearly" hint="0 disables yearly billing for paid plans.">
              <Input id="p-yearly" name="priceYearly" type="number" min={0} step="0.01" defaultValue={rupees(plan?.price_yearly) || "0"} />
            </Field>
          </div>
          <p className="mt-5 mb-2 text-[13px] font-medium text-foreground">Limits</p>
          <p className="mb-3 text-xs text-muted">Leave empty for unlimited. Limits are enforced server-side.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Projects" htmlFor="p-projects">
              <Input id="p-projects" name="maxProjects" type="number" min={0} defaultValue={limit(plan?.max_projects)} />
            </Field>
            <Field label="Deployments / month" htmlFor="p-deploys">
              <Input id="p-deploys" name="maxDeployments" type="number" min={0} defaultValue={limit(plan?.max_deployments_per_month)} />
            </Field>
            <Field label="Domains" htmlFor="p-domains">
              <Input id="p-domains" name="maxDomains" type="number" min={0} defaultValue={limit(plan?.max_domains)} />
            </Field>
            <Field label="Team members" htmlFor="p-team">
              <Input id="p-team" name="maxTeamMembers" type="number" min={0} defaultValue={limit(plan?.max_team_members)} />
            </Field>
            <Field label="Bandwidth (GB)" htmlFor="p-bw">
              <Input id="p-bw" name="bandwidthGb" type="number" min={0} defaultValue={limit(plan?.bandwidth_gb)} />
            </Field>
            <Field label="Builds / month" htmlFor="p-builds">
              <Input id="p-builds" name="maxBuilds" type="number" min={0} defaultValue={limit(plan?.max_builds_per_month)} />
            </Field>
          </div>
          <Field label="Features (one per line)" htmlFor="p-features" className="mt-4">
            <Textarea id="p-features" name="features" rows={5} defaultValue={plan?.features.join("\n")} />
          </Field>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="Display order" htmlFor="p-order">
              <Input id="p-order" name="displayOrder" type="number" min={0} defaultValue={plan?.display_order ?? 0} />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-foreground">
              <input type="checkbox" name="isActive" defaultChecked={plan?.is_active ?? true} className="h-4 w-4" /> Active
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-foreground">
              <input type="checkbox" name="isFeatured" defaultChecked={plan?.is_featured ?? false} className="h-4 w-4" /> Featured
            </label>
          </div>
        </ActionForm>
      </Dialog>
    </>
  );
}
