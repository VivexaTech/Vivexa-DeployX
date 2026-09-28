import type { Metadata } from "next";
import { AppShell } from "@/components/dashboard/app-shell";
import { DASHBOARD_NAV } from "@/components/dashboard/nav-config";
import { DevModeBanner } from "@/components/dashboard/dev-mode-banner";
import { requireUser } from "@/lib/auth/session";
import { getIntegrationStatus } from "@/lib/env";
import { getPlatformSettings } from "@/lib/data/settings";
import { isAdminRole } from "@/lib/permissions";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, settings] = await Promise.all([requireUser(), getPlatformSettings()]);
  return (
    <AppShell
      nav={DASHBOARD_NAV}
      variant="dashboard"
      user={{
        name: user.profile.name,
        email: user.email,
        avatarUrl: user.profile.avatar_url,
        isAdmin: isAdminRole(user.profile.role),
      }}
      banner={<DevModeBanner status={getIntegrationStatus()} maintenance={settings.maintenance_mode} />}
    >
      {children}
    </AppShell>
  );
}
