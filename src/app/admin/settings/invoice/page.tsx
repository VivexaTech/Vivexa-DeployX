import type { Metadata } from "next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/states";
import { ActionForm } from "@/components/admin/action-form";
import { CompanyLogoField } from "@/components/admin/company-logo-field";
import { saveInvoiceSettingsAction } from "../../actions";
import { requireAdmin } from "@/lib/auth/session";
import { getPlatformSettings } from "@/lib/data/settings";
import { missingInvoiceSettings } from "@/lib/billing/checkout";

export const metadata: Metadata = { title: "Invoice / Company Details" };

export default async function InvoiceSettingsPage() {
  await requireAdmin();
  const settings = await getPlatformSettings();
  const missing = missingInvoiceSettings(settings);

  return (
    <div className="max-w-4xl">
      {missing.length > 0 && (
        <Alert tone="warning" className="mb-6">
          Paid checkout is disabled until the {missing.join(" and ")} {missing.length > 1 ? "are" : "is"} set. These details appear on every invoice.
        </Alert>
      )}
      <ActionForm action={saveInvoiceSettingsAction} submitLabel="Save invoice details" className="space-y-6" footerClassName="sticky bottom-4 flex justify-end">
        <Card>
          <CardHeader
            title="Company details"
            description="Shown as the seller on invoices. Each invoice stores a copy of these details when it is issued, so later edits never change past invoices."
          />
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name" htmlFor="company_name">
              <Input id="company_name" name="company_name" defaultValue={settings.company_name} maxLength={120} required />
            </Field>
            <Field label="GST number (GSTIN)" htmlFor="company_gstin" hint="Optional. Validated as a 15-character GSTIN.">
              <Input id="company_gstin" name="company_gstin" defaultValue={settings.company_gstin} maxLength={15} className="font-mono uppercase" />
            </Field>
            <Field label="Company address" htmlFor="company_address" className="sm:col-span-2">
              <Textarea id="company_address" name="company_address" defaultValue={settings.company_address} rows={3} maxLength={500} required />
            </Field>
            <Field label="Phone" htmlFor="company_phone">
              <Input id="company_phone" name="company_phone" type="tel" defaultValue={settings.company_phone} maxLength={30} />
            </Field>
            <Field label="Email" htmlFor="company_email">
              <Input id="company_email" name="company_email" type="email" defaultValue={settings.company_email} maxLength={254} />
            </Field>
            <div className="sm:col-span-2">
              <CompanyLogoField initialUrl={settings.company_logo_url} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Invoice format" />
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Invoice number prefix" htmlFor="invoice_prefix" hint="Numbers are issued as PREFIX-YEAR-000001 and never reused.">
              <Input id="invoice_prefix" name="invoice_prefix" defaultValue={settings.invoice_prefix} maxLength={10} className="font-mono uppercase" required />
            </Field>
            <div className="hidden sm:block" />
            <Field label="Tax / legal note" htmlFor="invoice_tax_note" hint="Optional text printed above the footer, e.g. tax registration remarks." className="sm:col-span-2">
              <Textarea id="invoice_tax_note" name="invoice_tax_note" defaultValue={settings.invoice_tax_note} rows={3} maxLength={2000} />
            </Field>
            <Field label="Invoice footer" htmlFor="invoice_footer" hint="Optional, e.g. support contact or payment terms." className="sm:col-span-2">
              <Textarea id="invoice_footer" name="invoice_footer" defaultValue={settings.invoice_footer} rows={3} maxLength={2000} />
            </Field>
          </CardContent>
        </Card>
      </ActionForm>
    </div>
  );
}
