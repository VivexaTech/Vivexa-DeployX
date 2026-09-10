import { NextRequest, NextResponse } from "next/server";
import { isAppError } from "@/lib/errors";
import { getRequestOrigin } from "@/lib/env.server";
import { getGithubUser, storeGithubToken } from "@/lib/github/client";
import { exchangeGithubCode, GITHUB_CALLBACK_PATH, getGithubCallbackUrl, parseGithubState } from "@/lib/github/oauth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readOauthParams(request: NextRequest) {
  const fromNext = request.nextUrl.searchParams;
  let fromUrl: URLSearchParams | null = null;
  try {
    fromUrl = new URL(request.url).searchParams;
  } catch {
    fromUrl = null;
  }
  const pick = (name: string) => fromNext.get(name) || fromUrl?.get(name) || null;
  return {
    code: pick("code"),
    state: pick("state"),
    error: pick("error"),
    errorDescription: pick("error_description"),
  };
}

function redirectToGithubPage(origin: string, error?: string) {
  const path = error
    ? `${origin}/dashboard/github?error=${encodeURIComponent(error)}`
    : `${origin}/dashboard/github?connected=1`;
  return NextResponse.redirect(path);
}

export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request);
  const { code, state, error, errorDescription } = readOauthParams(request);

  logger.info("github.oauth.callback.start", {
    GITHUB_OAUTH_BASE_URL: origin,
    GITHUB_REDIRECT_URI: getGithubCallbackUrl(request),
    requestHost: request.headers.get("host"),
    forwardedHost: request.headers.get("x-forwarded-host"),
    environment: process.env.VERCEL === "1" ? "vercel" : process.env.NODE_ENV || "development",
    callbackRoute: GITHUB_CALLBACK_PATH,
    hasCode: Boolean(code),
    hasState: Boolean(state),
    githubError: error ?? null,
  });

  if (error || !code || !state) {
    logger.warn("github.oauth.callback.denied", {
      githubError: error ?? (code ? "missing_state" : "missing_code"),
      hasCode: Boolean(code),
      hasState: Boolean(state),
      errorDescriptionPresent: Boolean(errorDescription),
    });
    return redirectToGithubPage(origin, "github_denied");
  }

  try {
    const parsed = parseGithubState(state);
    const redirectUri = parsed.redirectUri || getGithubCallbackUrl(request);
    logger.info("github.oauth.callback.state", {
      GITHUB_REDIRECT_URI: redirectUri,
      hasUid: Boolean(parsed.uid),
      callbackRoute: GITHUB_CALLBACK_PATH,
    });

    const token = await exchangeGithubCode(code, redirectUri);
    let githubLogin: string | null = null;
    try {
      const githubUser = await getGithubUser(token);
      githubLogin = githubUser.login;
      logger.info("github.oauth.callback.user", {
        githubUserHttpStatus: 200,
        hasLogin: Boolean(githubLogin),
      });
    } catch (userError) {
      logger.error("github.oauth.callback.user_failed", {
        message: userError instanceof Error ? userError.message : "unknown",
        code: isAppError(userError) ? userError.code : undefined,
        status: isAppError(userError) ? userError.status : undefined,
      });
      return redirectToGithubPage(origin, "github_user");
    }

    try {
      await storeGithubToken(parsed.uid, token, githubLogin ?? undefined);
      logger.info("github.oauth.callback.stored", { ok: true, hasUid: Boolean(parsed.uid) });
    } catch (storeError) {
      logger.error("github.oauth.callback.store_failed", {
        message: storeError instanceof Error ? storeError.message : "unknown",
        code: isAppError(storeError) ? storeError.code : undefined,
        status: isAppError(storeError) ? storeError.status : undefined,
      });
      return redirectToGithubPage(origin, "github_store");
    }

    return redirectToGithubPage(origin);
  } catch (err) {
    const codeName = isAppError(err) ? err.code : "INTERNAL";
    const reason =
      codeName === "VALIDATION"
        ? "github_state"
        : codeName === "GITHUB_ERROR"
          ? "github_exchange"
          : codeName === "CONFIG_MISSING"
            ? "github_store"
            : "github_failed";
    logger.error("GitHub callback failed", {
      message: err instanceof Error ? err.message : "unknown",
      code: codeName,
      status: isAppError(err) ? err.status : undefined,
      reason,
    });
    return redirectToGithubPage(origin, reason);
  }
}
