import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { integrations } from "@/lib/env";

export const metadata: Metadata = { title: "Set new password", robots: { index: false } };

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Set a new password" description="Choose a strong password for your account" configured={integrations.supabase()}>
      <ResetPasswordForm />
    </AuthCard>
  );
}
