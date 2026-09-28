import type { Metadata } from "next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { ActionForm } from "@/components/admin/action-form";
import { saveSettingsAction } from "../actions";
import { requireAdmin } from "@/lib/auth/session";
import { getPlatformSettings } from "@/lib/data/settings";
import { getAllPlans } from "@/lib/data/plans";
import { LEGAL_META } from "@/lib/content/legal";

export const metadata: Metadata = { title: "Settings" };

function Toggle({ name, label, description, defaultChecked }: { name: string; label: string; description: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-border p-3">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4" />
      <span>
        <span className="block text-[13px] font-medium text-foreground">{label}</span>
        <span className="block text-xs text-muted">{description}</span>
      </span>
    </label>
  );
}

export default async function AdminSettingsPage() {
  await requireAdmin();
  const [settings, plans] = await Promise.all([getPlatformSettings(), getAllPlans()]);

  return (
    <>
      <ActionForm action={saveSettingsAction} submitLabel="Save settings" className="max-w-4xl space-y-6" footerClassName="sticky bottom-4 flex justify-end">
        <Card>
          <CardHeader title="General" />
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Platform name" htmlFor="platform_name">
              <Input id="platform_name" name="platform_name" defaultValue={settings.platform_name} required maxLength={60} />
            </Field>
            <Field label="Support email" htmlFor="support_email">
              <Input id="support_email" name="support_email" type="email" defaultValue={settings.support_email} required />
            </Field>
            <Field label="Logo URL" htmlFor="logo_url" hint="Optional https:// URL or relative path.">
              <Input id="logo_url" name="logo_url" defaultValue={settings.logo_url} maxLength={500} />
            </Field>
            <Field label="Default plan" htmlFor="default_plan_slug" hint="Used for new users and when paid plans expire.">
              <Select id="default_plan_slug" name="default_plan_slug" defaultValue={settings.default_plan_slug}>
                {plans.map((p) => (
                  <option key={p.id} value={p.slug}>
                    {p.name} ({p.slug})
                  </option>
                ))}
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Access & visibility" />
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Toggle name="signup_enabled" label="Allow new signups" description="When off, the registration form is disabled." defaultChecked={settings.signup_enabled} />
            <Toggle name="pricing_visible" label="Show pricing page" description="Hide public pricing while plans are being finalised." defaultChecked={settings.pricing_visible} />
            <Toggle
              name="maintenance_mode"
              label="Maintenance mode"
              description="Shows a banner and pauses new deployments."
              defaultChecked={settings.maintenance_mode}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Deployments" />
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Toggle name="deployments_enabled" label="Enable deployments" description="When off, users cannot start new deployments." defaultChecked={settings.deployments_enabled} />
            <Field label="Max files per deployment" htmlFor="max_upload_files" hint="Upper bound on source files uploaded per build.">
              <Input id="max_upload_files" name="max_upload_files" type="number" min={100} max={50000} defaultValue={settings.max_upload_files} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Legal content"
            description="Leave empty to use the built-in templates. Supports plain text with blank lines between paragraphs and lines starting with '## ' as headings. Have legal documents reviewed by a qualified professional."
          />
          <CardContent className="space-y-4">
            {Object.values(LEGAL_META).map((meta) => (
              <Field key={meta.settingKey} label={meta.title} htmlFor={meta.settingKey}>
                <Textarea
                  id={meta.settingKey}
                  name={meta.settingKey}
                  defaultValue={settings[meta.settingKey]}
                  rows={6}
                  className="font-mono text-xs"
                  placeholder="Using the default template"
                />
              </Field>
            ))}
          </CardContent>
        </Card>
      </ActionForm>
    </>
  );
}
