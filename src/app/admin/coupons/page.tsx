import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ActionButton } from "@/components/admin/action-form";
import { CouponEditor } from "@/components/admin/coupon-editor";
import { saveCouponAction, toggleCouponAction } from "../actions";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency, formatDate, isPast } from "@/lib/utils";
import type { Coupon } from "@/types/database";

export const metadata: Metadata = { title: "Coupons" };

export default async function AdminCouponsPage() {
  await requireAdmin();
  const { data } = await createAdminClient().from("coupons").select("*").order("created_at", { ascending: false });
  const coupons = (data as Coupon[]) ?? [];

  return (
    <>
      <PageHeader title="Coupons" description="Discount codes applied at checkout. Validated server-side." actions={<CouponEditor action={saveCouponAction} />} />
      <Card className="overflow-hidden">
        {coupons.length === 0 ? (
          <EmptyState title="No coupons" description="Create a coupon to offer discounts at checkout." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Code</TH>
                <TH>Discount</TH>
                <TH>Redemptions</TH>
                <TH>Valid until</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {coupons.map((c) => {
                const expired = isPast(c.valid_until);
                return (
                  <TR key={c.id}>
                    <TD>
                      <p className="font-mono font-medium text-foreground">{c.code}</p>
                      {c.description && <p className="text-xs text-muted">{c.description}</p>}
                    </TD>
                    <TD>{c.discount_type === "percent" ? `${c.discount_value}%` : formatCurrency(c.discount_value)}</TD>
                    <TD>
                      {c.redeemed_count}
                      {c.max_redemptions !== null && <span className="text-muted"> / {c.max_redemptions}</span>}
                    </TD>
                    <TD className="text-muted">{c.valid_until ? formatDate(c.valid_until) : "No expiry"}</TD>
                    <TD>
                      <Badge tone={c.is_active && !expired ? "success" : "neutral"} dot>
                        {expired ? "Expired" : c.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TD>
                    <TD>
                      <div className="flex justify-end gap-2">
                        <CouponEditor action={saveCouponAction} coupon={c} />
                        <ActionButton action={toggleCouponAction} fields={{ couponId: c.id, active: String(!c.is_active) }} variant="ghost">
                          {c.is_active ? "Deactivate" : "Activate"}
                        </ActionButton>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
