import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/auth/actions";
import { getSessionState } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Account setup incomplete", robots: { index: false } };

export default async function AccountErrorPage() {
  const state = await getSessionState();
  if (state.status === "ok") redirect("/dashboard");
  if (state.status === "anonymous") redirect("/auth/login");

  return (
    <AuthCard title="Account setup incomplete" description="You're signed in, but your profile couldn't be loaded">
      <p className="text-sm leading-relaxed text-muted">
        This usually means the database hasn&apos;t been initialised. Apply the SQL in{" "}
        <code className="rounded bg-background-subtle px-1 py-0.5 text-foreground">supabase/migrations</code> and{" "}
        <code className="rounded bg-background-subtle px-1 py-0.5 text-foreground">supabase/seed.sql</code> to your Supabase
        project, then reload this page. The server log contains the exact error.
      </p>
      <form action={signOutAction} className="mt-5">
        <Button type="submit" variant="outline" className="w-full">
          Log out
        </Button>
      </form>
    </AuthCard>
  );
}
