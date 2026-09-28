import { PageHeader } from "@/components/ui/misc";
import { LinkTabs } from "@/components/ui/tabs";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Platform Settings" description="Changes apply immediately across the platform and are audit logged." />
      <LinkTabs
        tabs={[
          { label: "General", href: "/admin/settings", exact: true },
          { label: "Invoice / Company Details", href: "/admin/settings/invoice" },
          { label: "Tax Settings", href: "/admin/settings/tax" },
        ]}
      />
      {children}
    </>
  );
}
