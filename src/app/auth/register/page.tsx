import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/auth-forms";
import { Alert } from "@/components/ui/states";
import { integrations } from "@/lib/env";
import { getPlatformSettings } from "@/lib/data/settings";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function RegisterPage() {
  const settings = await getPlatformSettings();
  return (
    <AuthCard
      title="Create your account"
      description="Start deploying in minutes"
      configured={integrations.supabase()}
      footer={
        <>
          Already have an account?{" "}
          <Link href="/auth/login" className="font-medium text-foreground hover:underline">
            Log in
          </Link>
        </>
      }
    >
      {settings.signup_enabled ? (
        <RegisterForm />
      ) : (
        <Alert tone="warning">New registrations are currently disabled. Please check back later.</Alert>
      )}
    </AuthCard>
  );
}
