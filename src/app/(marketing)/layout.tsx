import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { getSessionUser } from "@/lib/auth/session";
import { getPlatformSettings } from "@/lib/data/settings";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [user, settings] = await Promise.all([getSessionUser(), getPlatformSettings()]);
  return (
    <div className="flex min-h-screen flex-col">
      {settings.maintenance_mode && (
        <div className="border-b border-warning/30 bg-warning-soft px-4 py-2 text-center text-[13px] text-foreground">
          Scheduled maintenance is in progress. Some features may be temporarily unavailable.
        </div>
      )}
      <SiteHeader signedIn={Boolean(user)} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
