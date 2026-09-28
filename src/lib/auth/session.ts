import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { integrations } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRole } from "@/lib/permissions";
import type { Profile } from "@/types/database";

export type SessionUser = {
  id: string;
  email: string;
  profile: Profile;
};

type SessionState =
  | { status: "anonymous" }
  | { status: "no-profile" }
  | { status: "ok"; user: SessionUser };

/**
 * Resolves the auth session and profile. "no-profile" means Supabase has a
 * valid session but the profile row can't be loaded (typically migrations
 * not applied); callers must not treat it as signed out, or the proxy's
 * auth-page redirect would bounce the user back in a loop.
 */
export const getSessionState = cache(async (): Promise<SessionState> => {
  // Session-dependent output must never be prerendered, even when Supabase isn't configured at build time.
  await connection();
  if (!integrations.supabase()) return { status: "anonymous" };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { status: "anonymous" };

  const result = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  let profile = result.data;
  let profileError = result.error?.message;
  if (!profile && integrations.supabaseAdmin()) {
    // Accounts created before the signup trigger existed won't have a profile yet.
    const created = await createAdminClient()
      .from("profiles")
      .upsert({ id: data.user.id, email: data.user.email ?? "", name: data.user.user_metadata?.name ?? null })
      .select("*")
      .single();
    profile = created.data;
    profileError = created.error?.message ?? profileError;
  }
  if (!profile) {
    console.error("[auth] Profile unavailable for signed-in user:", profileError ?? "no row returned");
    return { status: "no-profile" };
  }

  const user = { id: data.user.id, email: data.user.email ?? (profile as Profile).email, profile: profile as Profile };
  return { status: "ok", user };
});

/** Returns the authenticated user + profile, or null. Deduplicated per request. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const state = await getSessionState();
  return state.status === "ok" ? state.user : null;
}

/** For pages/actions that require a signed-in, active user. */
export async function requireUser(): Promise<SessionUser> {
  const state = await getSessionState();
  if (state.status === "no-profile") redirect("/auth/account-error");
  if (state.status === "anonymous") redirect("/auth/login");
  const { user } = state;
  if (user.profile.status === "suspended") redirect("/auth/suspended");
  return user;
}

/** For admin pages/actions. Checked server-side against the database role. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isAdminRole(user.profile.role)) redirect("/dashboard");
  return user;
}

/** Variant for route handlers: returns null instead of redirecting. */
export async function getActiveUserForApi(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user || user.profile.status !== "active") return null;
  return user;
}
