import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/env";
import { getGithubUser, storeGithubToken } from "@/lib/github/client";
import { exchangeGithubCode, parseGithubState } from "@/lib/github/oauth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const appUrl = getAppUrl();
  if (error || !code || !state) {
    return NextResponse.redirect(`${appUrl}/dashboard/github?error=github_denied`);
  }
  try {
    const parsed = parseGithubState(state);
    const token = await exchangeGithubCode(code);
    const githubUser = await getGithubUser(token);
    await storeGithubToken(parsed.uid, token, githubUser.login);
    return NextResponse.redirect(`${appUrl}/dashboard/github?connected=1`);
  } catch (err) {
    logger.error("GitHub callback failed", {
      message: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.redirect(`${appUrl}/dashboard/github?error=github_failed`);
  }
}
