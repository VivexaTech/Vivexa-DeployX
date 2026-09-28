import { NextResponse, type NextRequest } from "next/server";
import { getActiveUserForApi } from "@/lib/auth/session";
import { exchangeCodeForToken, githubFetch, logGithub } from "@/lib/github/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret, safeCompare } from "@/lib/utils/crypto";
import { safeNextPath } from "@/lib/auth/origin";
import { integrations } from "@/lib/env";
import { PublicError } from "@/lib/utils/sanitize";

export const dynamic = "force-dynamic";

function withParam(path: string, value: string) {
  return `${path}${path.includes("?") ? "&" : "?"}github=${value}`;
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(request.cookies.get("dx_gh_next")?.value, "/dashboard/projects/new");
  const stored = request.cookies.get("dx_gh_state")?.value ?? "";
  const [storedState, storedUserId] = stored.split(".");
  const state = params.get("state") ?? "";
  const code = params.get("code");

  const finish = (path: string) => {
    const response = NextResponse.redirect(new URL(path, origin));
    response.cookies.set("dx_gh_state", "", { path: "/api/github", maxAge: 0 });
    response.cookies.set("dx_gh_next", "", { path: "/api/github", maxAge: 0 });
    return response;
  };

  logGithub("info", "callback_started", { hasCode: Boolean(code), hasState: Boolean(state), hasStateCookie: Boolean(stored) });

  const oauthError = params.get("error");
  if (oauthError) {
    logGithub("warn", "authorization_denied", { githubError: oauthError });
    return finish(withParam(next, "denied"));
  }

  const user = await getActiveUserForApi();
  if (!user) {
    logGithub("warn", "callback_no_session");
    return finish("/auth/login?next=/dashboard/projects/new");
  }
  if (!code) {
    logGithub("warn", "callback_missing_code", { userId: user.id });
    return finish(withParam(next, "state"));
  }
  // The state must match the httpOnly cookie set by /api/github/connect for this same DeployX user.
  if (!storedState || !state || !safeCompare(storedState, state) || storedUserId !== user.id) {
    logGithub("warn", "callback_invalid_state", { userId: user.id, hasStateCookie: Boolean(stored) });
    return finish(withParam(next, "state"));
  }
  if (!integrations.encryption()) return finish(withParam(next, "encryption"));
  if (!integrations.supabaseAdmin()) return finish(withParam(next, "database"));

  let accessToken: string;
  let scope: string;
  try {
    ({ accessToken, scope } = await exchangeCodeForToken(code));
    logGithub("info", "token_exchanged", { userId: user.id, scopes: scope });
  } catch {
    return finish(withParam(next, "exchange"));
  }

  let profile: { id: number; login: string; avatar_url: string };
  try {
    profile = await githubFetch<{ id: number; login: string; avatar_url: string }>(accessToken, "/user");
    logGithub("info", "github_user_retrieved", { userId: user.id, githubUserId: profile.id, login: profile.login });
  } catch (error) {
    logGithub("error", "github_user_failed", { userId: user.id, reason: error instanceof PublicError ? error.message : "unexpected" });
    return finish(withParam(next, "error"));
  }

  let encrypted: string;
  try {
    encrypted = encryptSecret(accessToken);
  } catch {
    logGithub("error", "token_encrypt_failed", { userId: user.id });
    return finish(withParam(next, "encryption"));
  }

  const { error } = await createAdminClient()
    .from("github_connections")
    .upsert(
      {
        user_id: user.id,
        github_user_id: profile.id,
        username: profile.login,
        avatar_url: profile.avatar_url,
        scopes: scope,
        access_token_encrypted: encrypted,
      },
      { onConflict: "user_id" },
    );
  if (error) {
    logGithub("error", "connection_upsert_failed", { userId: user.id, dbError: error.message, dbCode: error.code });
    return finish(withParam(next, "database"));
  }

  logGithub("info", "connection_saved", { userId: user.id, githubUserId: profile.id });
  return finish(withParam(next, "connected"));
}
