import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/origin";
import { integrations } from "@/lib/env";

/** Handles Supabase email confirmation, magic links and password recovery links. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNextPath(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (!integrations.supabase()) return NextResponse.redirect(new URL("/auth/login", url.origin));

  // Supabase links never carry `state`; GitHub OAuth redirects do. Landing here means the GitHub
  // OAuth app / GITHUB_CALLBACK_URL points at the wrong route, so the code can't be used.
  if (code && url.searchParams.has("state")) {
    console.error(
      JSON.stringify({ scope: "github", event: "callback_misrouted", hint: "Set the callback URL to /api/github/callback" }),
    );
    return NextResponse.redirect(new URL("/dashboard/projects/new?github=callback", url.origin));
  }

  const supabase = await createClient();
  let ok = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
  }

  const destination = ok ? next : "/auth/login?error=link";
  return NextResponse.redirect(new URL(destination, url.origin));
}
