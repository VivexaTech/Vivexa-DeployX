"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/components/providers/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { googleSignInErrorMessage, isGoogleSignInCancelled } from "@/lib/auth/google-errors";

export function AuthScreen({ mode }: { mode: "login" | "signup" }) {
  const { signInWithGoogle, configured, loading: authLoading, user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function destination() {
    const next = params.get("next");
    if (next && next.startsWith("/")) return next;
    const plan = params.get("plan");
    if (plan) return `/dashboard/billing?plan=${encodeURIComponent(plan)}`;
    return "/dashboard";
  }

  useEffect(() => {
    if (authLoading) return;
    apiFetch("/api/me")
      .then(() => {
        router.replace(destination());
        router.refresh();
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  async function onGoogle() {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      router.replace(destination());
      router.refresh();
    } catch (err) {
      if (!isGoogleSignInCancelled(err)) {
        setError(googleSignInErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-accent p-10 text-white dark:text-ink lg:flex">
        <Logo className="text-white dark:text-ink" />
        <div>
          <h1 className="text-4xl font-semibold">Deploy from GitHub without leaving Vivexa DeployX.</h1>
          <p className="mt-4 max-w-md text-sm opacity-80">
            Continue with Google. We create your workspace, then you connect GitHub and choose a plan.
          </p>
        </div>
        <p className="text-sm opacity-70">Vivexa Tech</p>
      </div>
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-between">
            <Link href="/">
              <Logo />
            </Link>
            <ThemeToggle compact />
          </div>
          <Card className="p-6">
            <h2 className="text-2xl font-semibold">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
            <p className="mt-2 text-sm text-muted">
              {mode === "login"
                ? "Sign in with Google to open your dashboard."
                : "Get started with Google authentication."}
            </p>
            {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
            <Button className="mt-6 w-full" onClick={onGoogle} disabled={!configured || loading}>
              {loading ? "Connecting..." : "Continue with Google"}
            </Button>
            {!configured ? (
              <p className="mt-4 rounded-xl bg-accent-soft p-3 text-sm">
                Firebase public keys are not configured yet. Add the NEXT_PUBLIC_FIREBASE_* values from .env.example.
              </p>
            ) : null}
            <p className="mt-4 text-sm text-muted">
              {mode === "login" ? (
                <>
                  New here? <Link href="/signup">Get started</Link>
                </>
              ) : (
                <>
                  Already have an account? <Link href="/login">Login</Link>
                </>
              )}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
