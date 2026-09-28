import { NextResponse, type NextRequest } from "next/server";
import { getActiveUserForApi } from "@/lib/auth/session";
import { buildAuthorizeUrl, logGithub } from "@/lib/github/client";
import { githubCallbackProblem, integrations } from "@/lib/env";
import { randomToken } from "@/lib/utils/crypto";
import { safeNextPath } from "@/lib/auth/origin";

export const dynamic = "force-dynamic";

/** Starts the GitHub OAuth flow with a CSRF state stored in an httpOnly cookie. */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const user = await getActiveUserForApi();
  if (!user) return NextResponse.redirect(new URL("/auth/login?next=/dashboard/settings", origin));

  const next = safeNextPath(request.nextUrl.searchParams.get("next"), "/dashboard/projects/new");
  if (!integrations.github()) {
    return NextResponse.redirect(new URL(`${next}${next.includes("?") ? "&" : "?"}github=unconfigured`, origin));
  }
  if (!integrations.encryption()) {
    return NextResponse.redirect(new URL(`${next}${next.includes("?") ? "&" : "?"}github=encryption`, origin));
  }
  if (!integrations.supabaseAdmin()) {
    return NextResponse.redirect(new URL(`${next}${next.includes("?") ? "&" : "?"}github=database`, origin));
  }
  const callbackProblem = githubCallbackProblem();
  if (callbackProblem) {
    logGithub("error", "callback_url_misconfigured", { problem: callbackProblem });
    return NextResponse.redirect(new URL(`${next}${next.includes("?") ? "&" : "?"}github=callback`, origin));
  }

  const state = randomToken(24);
  const response = NextResponse.redirect(buildAuthorizeUrl(state));
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 600,
    path: "/api/github",
  };
  response.cookies.set("dx_gh_state", `${state}.${user.id}`, cookieOptions);
  response.cookies.set("dx_gh_next", next, cookieOptions);
  return response;
}
