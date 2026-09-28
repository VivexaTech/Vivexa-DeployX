import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/auth/actions";
import { getPlatformSettings } from "@/lib/data/settings";

export const metadata: Metadata = { title: "Account suspended", robots: { index: false } };

export default async function SuspendedPage() {
  const settings = await getPlatformSettings();
  return (
    <AuthCard title="Account suspended" description="Access to this account has been restricted">
      <p className="text-sm leading-relaxed text-muted">
        If you believe this is a mistake, contact{" "}
        <a href={`mailto:${settings.support_email}`} className="text-foreground underline">
          {settings.support_email}
        </a>
        .
      </p>
      <form action={signOutAction} className="mt-5">
        <Button type="submit" variant="outline" className="w-full">
          Log out
        </Button>
      </form>
    </AuthCard>
  );
}
