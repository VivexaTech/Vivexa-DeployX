import type { Metadata } from "next";
import { AppShell } from "@/components/dashboard/app-shell";
import { ADMIN_NAV } from "@/components/dashboard/nav-config";
import { DevModeBanner } from "@/components/dashboard/dev-mode-banner";
import { requireAdmin } from "@/lib/auth/session";
import { getIntegrationStatus } from "@/lib/env";
import { getPlatformSettings } from "@/lib/data/settings";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · Vivexa DeployX" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, settings] = await Promise.all([requireAdmin(), getPlatformSettings()]);
  return (
    <AppShell
      nav={ADMIN_NAV}
      variant="admin"
      user={{ name: user.profile.name, email: user.email, avatarUrl: user.profile.avatar_url, isAdmin: true }}
      banner={<DevModeBanner status={getIntegrationStatus()} maintenance={settings.maintenance_mode} />}
    >
      {children}
    </AppShell>
  );
}
