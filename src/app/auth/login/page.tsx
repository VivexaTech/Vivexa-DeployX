import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/auth-forms";
import { Alert } from "@/components/ui/states";
import { integrations } from "@/lib/env";
import { safeNextPath } from "@/lib/auth/origin";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <AuthCard
      title="Welcome back"
      description="Log in to your DeployX account"
      configured={integrations.supabase()}
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" className="font-medium text-foreground hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      {error && (
        <Alert tone="danger" className="mb-4">
          {error === "link" ? "That link is invalid or has expired. Please try again." : "Authentication failed. Please try again."}
        </Alert>
      )}
      <LoginForm next={next ? safeNextPath(next) : undefined} />
    </AuthCard>
  );
}
