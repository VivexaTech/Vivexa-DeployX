import { signValue, tokenStoreReady, verifySignedValue } from "@/lib/crypto";
import { getAppUrl, getRequestOrigin, readEnv, requireServerEnv } from "@/lib/env.server";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const GITHUB_AUTHORIZE = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN = "https://github.com/login/oauth/access_token";
export const GITHUB_CALLBACK_PATH = "/api/github/callback";

export function githubConfigured() {
  return Boolean(readEnv("GITHUB_CLIENT_ID") && readEnv("GITHUB_CLIENT_SECRET"));
}

export function getGithubCallbackUrl(request?: Request) {
  const origin = request ? getRequestOrigin(request) : getAppUrl();
  return `${origin}${GITHUB_CALLBACK_PATH}`;
}

export function githubOAuthLogMeta(request: Request, redirectUri: string) {
  return {
    GITHUB_OAUTH_BASE_URL: getRequestOrigin(request),
    GITHUB_REDIRECT_URI: redirectUri,
    requestHost: request.headers.get("host"),
    forwardedHost: request.headers.get("x-forwarded-host"),
    environment: readEnv("VERCEL") === "1" ? "vercel" : process.env.NODE_ENV || "development",
    nodeEnv: process.env.NODE_ENV ?? null,
    callbackRoute: GITHUB_CALLBACK_PATH,
    vaultReady: tokenStoreReady(),
  };
}

export function createGithubState(uid: string, redirectUri: string) {
  const payload = JSON.stringify({ uid, redirectUri, exp: Date.now() + 10 * 60 * 1000 });
  return `${Buffer.from(payload).toString("base64url")}.${signValue(payload)}`;
}

export function parseGithubState(state: string) {
  const dot = state.indexOf(".");
  const encoded = dot === -1 ? "" : state.slice(0, dot);
  const signature = dot === -1 ? "" : state.slice(dot + 1);
  if (!encoded || !signature) {
    throw new AppError("VALIDATION", "Invalid GitHub authorization state.", 400);
  }
  const payload = Buffer.from(encoded, "base64url").toString("utf8");
  if (!verifySignedValue(payload, signature)) {
    throw new AppError("VALIDATION", "GitHub authorization state could not be verified.", 400);
  }
  const parsed = JSON.parse(payload) as { uid: string; redirectUri?: string; exp: number };
  if (parsed.exp < Date.now()) {
    throw new AppError("VALIDATION", "GitHub authorization expired. Please try again.", 400);
  }
  if (!parsed.uid) {
    throw new AppError("VALIDATION", "Invalid GitHub authorization state.", 400);
  }
  return parsed;
}

export function getGithubAuthorizeUrl(uid: string, request: Request) {
  requireServerEnv(["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"]);
  if (!tokenStoreReady()) {
    throw new AppError(
      "CONFIG_MISSING",
      "APP_ENCRYPTION_KEY is required to connect GitHub.",
      503,
    );
  }
  const redirectUri = getGithubCallbackUrl(request);
  const params = new URLSearchParams({
    client_id: readEnv("GITHUB_CLIENT_ID"),
    redirect_uri: redirectUri,
    scope: "repo read:user",
    state: createGithubState(uid, redirectUri),
    allow_signup: "false",
  });
  return { url: `${GITHUB_AUTHORIZE}?${params.toString()}`, redirectUri };
}

function parseTokenPayload(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return {} as { access_token?: string; error?: string; error_description?: string };
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };
  }
  const params = new URLSearchParams(trimmed);
  return {
    access_token: params.get("access_token") || undefined,
    error: params.get("error") || undefined,
    error_description: params.get("error_description") || undefined,
  };
}

export async function exchangeGithubCode(code: string, redirectUri: string) {
  requireServerEnv(["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"]);
  const body = new URLSearchParams({
    client_id: readEnv("GITHUB_CLIENT_ID"),
    client_secret: readEnv("GITHUB_CLIENT_SECRET"),
    code,
    redirect_uri: redirectUri,
  });
  const response = await fetch(GITHUB_TOKEN, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const raw = await response.text();
  let data: { access_token?: string; error?: string; error_description?: string };
  try {
    data = parseTokenPayload(raw);
  } catch {
    logger.error("github.oauth.exchange.parse_failed", {
      httpStatus: response.status,
      contentType: response.headers.get("content-type"),
    });
    throw new AppError("GITHUB_ERROR", "GitHub token exchange returned an invalid response.", 502);
  }
  logger.info("github.oauth.exchange", {
    httpStatus: response.status,
    hasAccessGrant: Boolean(data.access_token),
    githubError: data.error ?? null,
  });
  if (!data.access_token) {
    throw new AppError(
      "GITHUB_ERROR",
      data.error === "redirect_uri_mismatch"
        ? "GitHub rejected the callback URL. Check the OAuth App authorization callback URL."
        : "GitHub authorization failed. Please retry.",
      400,
      { githubError: data.error ?? "missing_access_token", httpStatus: response.status },
    );
  }
  return data.access_token;
}
