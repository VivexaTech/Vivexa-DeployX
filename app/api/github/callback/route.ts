import { NextResponse } from "next/server";
import { getRequestOrigin } from "@/lib/env.server";
import { getGithubUser, storeGithubToken } from "@/lib/github/client";
import { exchangeGithubCode, GITHUB_CALLBACK_PATH, getGithubCallbackUrl, parseGithubState } from "@/lib/github/oauth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const origin = getRequestOrigin(request);
  if (error || !code || !state) {
    return NextResponse.redirect(`${origin}/dashboard/github?error=github_denied`);
  }
  try {
    const parsed = parseGithubState(state);
    const redirectUri = parsed.redirectUri || getGithubCallbackUrl(request);
    logger.info("github.oauth.callback", {
      GITHUB_OAUTH_BASE_URL: origin,
      GITHUB_REDIRECT_URI: redirectUri,
      requestHost: request.headers.get("host"),
      environment: process.env.VERCEL === "1" ? "vercel" : process.env.NODE_ENV || "development",
      callbackRoute: GITHUB_CALLBACK_PATH,
    });
    const token = await exchangeGithubCode(code, redirectUri);
    const githubUser = await getGithubUser(token);
    await storeGithubToken(parsed.uid, token, githubUser.login);
    return NextResponse.redirect(`${origin}/dashboard/github?connected=1`);
  } catch (err) {
    logger.error("GitHub callback failed", {
      message: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.redirect(`${origin}/dashboard/github?error=github_failed`);
  }
}
