import type { Metadata } from "next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { ActionForm } from "@/components/admin/action-form";
import { saveTaxSettingsAction } from "../../actions";
import { requireAdmin } from "@/lib/auth/session";
import { getPlatformSettings } from "@/lib/data/settings";
import { taxConfigFrom } from "@/lib/billing/checkout";
import { calculateTax, formatRate, INDIAN_STATES, stateName } from "@/lib/billing/tax";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Tax Settings" };

const SAMPLE_BASE = 100_000;

export default async function TaxSettingsPage() {
  await requireAdmin();
  const settings = await getPlatformSettings();
  const config = taxConfigFrom(settings);
  const other = INDIAN_STATES.find((s) => s.code !== settings.tax_home_state)?.code ?? "DL";
  let intra: ReturnType<typeof calculateTax> | null = null;
  let inter: ReturnType<typeof calculateTax> | null = null;
  try {
    intra = calculateTax({ baseAmount: SAMPLE_BASE, stateCode: settings.tax_home_state, config });
    inter = calculateTax({ baseAmount: SAMPLE_BASE, stateCode: other, config });
  } catch {
    // Invalid stored configuration; the form below lets an admin correct it.
  }

  return (
    <div className="grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <ActionForm action={saveTaxSettingsAction} submitLabel="Save tax settings" className="space-y-6">
        <Card>
          <CardHeader
            title="GST"
            description="Customers billed in the seller state are charged CGST + SGST (half the GST rate each); all other states are charged IGST at the full rate."
          />
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="GST rate (%)" htmlFor="gst_rate">
              <Input id="gst_rate" name="gst_rate" type="number" step="0.01" min={0} max={100} defaultValue={settings.gst_rate} required />
            </Field>
            <Field label="Seller state" htmlFor="tax_home_state" hint="Determines intra-state vs inter-state tax.">
              <Select id="tax_home_state" name="tax_home_state" defaultValue={settings.tax_home_state}>
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Other tax" description="An additional tax applied to the plan price on every purchase. Set the rate to 0 to disable it." />
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Other tax name" htmlFor="other_tax_name">
              <Input id="other_tax_name" name="other_tax_name" defaultValue={settings.other_tax_name} maxLength={40} required />
            </Field>
            <Field label="Other tax rate (%)" htmlFor="other_tax_rate">
              <Input id="other_tax_rate" name="other_tax_rate" type="number" step="0.01" min={0} max={100} defaultValue={settings.other_tax_rate} required />
            </Field>
          </CardContent>
        </Card>
        <p className="text-xs text-muted">
          Changes apply to new checkouts only. Existing payments and invoices keep the rates and names they were issued with. Confirm your tax configuration with a qualified tax professional.
        </p>
      </ActionForm>

      <Card className="h-fit">
        <CardHeader title="Preview" description={`For a plan price of ${formatMoney(SAMPLE_BASE)} with the saved settings.`} />
        <CardContent className="space-y-5 text-[13px]">
          {intra && inter ? (
            <>
              <PreviewBlock
                title={`Billing state: ${stateName(settings.tax_home_state)}`}
                rows={[
                  [`CGST ${formatRate(intra.cgstRate)}%`, intra.cgstAmount],
                  [`SGST ${formatRate(intra.sgstRate)}%`, intra.sgstAmount],
                  [`${intra.otherTaxName} ${formatRate(intra.otherTaxRate)}%`, intra.otherTaxAmount],
                ]}
                total={intra.totalAmount}
              />
              <PreviewBlock
                title="Billing state: any other state"
                rows={[
                  [`IGST ${formatRate(inter.igstRate)}%`, inter.igstAmount],
                  [`${inter.otherTaxName} ${formatRate(inter.otherTaxRate)}%`, inter.otherTaxAmount],
                ]}
                total={inter.totalAmount}
              />
            </>
          ) : (
            <p className="text-danger">The saved tax configuration is invalid. Save valid values to enable checkout.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PreviewBlock({ title, rows, total }: { title: string; rows: [string, number][]; total: number }) {
  return (
    <div>
      <p className="mb-2 font-medium text-foreground">{title}</p>
      <dl className="space-y-1">
        <div className="flex justify-between text-muted">
          <dt>Plan price</dt>
          <dd className="tabular-nums">{formatMoney(SAMPLE_BASE)}</dd>
        </div>
        {rows
          .filter(([, amount]) => amount > 0)
          .map(([label, amount]) => (
            <div key={label} className="flex justify-between text-muted">
              <dt>{label}</dt>
              <dd className="tabular-nums">{formatMoney(amount)}</dd>
            </div>
          ))}
        <div className="flex justify-between border-t border-border pt-1 font-medium text-foreground">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatMoney(total)}</dd>
        </div>
      </dl>
    </div>
  );
}
