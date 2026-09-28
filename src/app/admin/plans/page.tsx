import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ActionButton } from "@/components/admin/action-form";
import { PlanEditor } from "@/components/admin/plan-editor";
import { deletePlanAction, savePlanAction, togglePlanAction } from "../actions";
import { requireAdmin } from "@/lib/auth/session";
import { getAllPlans } from "@/lib/data/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperAdmin } from "@/lib/permissions";
import { formatCurrency, formatLimit } from "@/lib/utils";

export const metadata: Metadata = { title: "Plans" };

export default async function AdminPlansPage() {
  const admin = await requireAdmin();
  const plans = await getAllPlans();
  const { data: subs } = await createAdminClient().from("subscriptions").select("plan_id").eq("status", "active");
  const subscriberCount = new Map<string, number>();
  for (const s of (subs as { plan_id: string }[]) ?? []) subscriberCount.set(s.plan_id, (subscriberCount.get(s.plan_id) ?? 0) + 1);
  const superAdmin = isSuperAdmin(admin.profile.role);

  return (
    <>
      <PageHeader
        title="Plans"
        description="Pricing and limits shown on the pricing page and enforced across the platform."
        actions={<PlanEditor action={savePlanAction} />}
      />
      <Card className="overflow-hidden">
        {plans.length === 0 ? (
          <EmptyState title="No plans" description="Create a plan or run supabase/seed.sql to add the default plans." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Plan</TH>
                <TH>Monthly</TH>
                <TH>Yearly</TH>
                <TH>Limits</TH>
                <TH>Subscribers</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {plans.map((plan) => (
                <TR key={plan.id}>
                  <TD>
                    <p className="font-medium text-foreground">
                      {plan.name} {plan.is_featured && <Badge tone="accent" className="ml-1">Featured</Badge>}
                    </p>
                    <p className="font-mono text-xs text-muted">{plan.slug}</p>
                  </TD>
                  <TD>{formatCurrency(plan.price_monthly, plan.currency)}</TD>
                  <TD>{formatCurrency(plan.price_yearly, plan.currency)}</TD>
                  <TD className="text-xs text-muted">
                    {formatLimit(plan.max_projects)} projects · {formatLimit(plan.max_deployments_per_month)} deploys/mo · {formatLimit(plan.max_domains)} domains
                  </TD>
                  <TD>{subscriberCount.get(plan.id) ?? 0}</TD>
                  <TD>
                    <Badge tone={plan.is_active ? "success" : "neutral"} dot>
                      {plan.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TD>
                  <TD>
                    <div className="flex justify-end gap-2">
                      <PlanEditor action={savePlanAction} plan={plan} />
                      <ActionButton
                        action={togglePlanAction}
                        fields={{ planId: plan.id, active: String(!plan.is_active) }}
                        variant="ghost"
                        confirm={
                          plan.is_active
                            ? {
                                title: `Deactivate ${plan.name}?`,
                                description: "It will be hidden from pricing and checkout. Existing subscribers keep it until their period ends.",
                                confirmLabel: "Deactivate",
                              }
                            : undefined
                        }
                      >
                        {plan.is_active ? "Deactivate" : "Activate"}
                      </ActionButton>
                      {superAdmin && (
                        <ActionButton
                          action={deletePlanAction}
                          fields={{ planId: plan.id }}
                          variant="ghost"
                          confirm={{
                            title: `Delete ${plan.name}?`,
                            description: "Plans with any subscription or payment history cannot be deleted.",
                            confirmLabel: "Delete",
                            danger: true,
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </ActionButton>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
