import { getAppUrl, getRequestOrigin, readEnv, requireServerEnv } from "@/lib/env.server";
import { AppError } from "@/lib/errors";
import { signValue, verifySignedValue } from "@/lib/crypto";

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
  };
}

export function createGithubState(uid: string, redirectUri: string) {
  const payload = JSON.stringify({ uid, redirectUri, exp: Date.now() + 10 * 60 * 1000 });
  return `${Buffer.from(payload).toString("base64url")}.${signValue(payload)}`;
}

export function parseGithubState(state: string) {
  const [encoded, signature] = state.split(".");
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

export async function exchangeGithubCode(code: string, redirectUri: string) {
  requireServerEnv(["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"]);
  const response = await fetch(GITHUB_TOKEN, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: readEnv("GITHUB_CLIENT_ID"),
      client_secret: readEnv("GITHUB_CLIENT_SECRET"),
      code,
      redirect_uri: redirectUri,
    }),
  });
  const data = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
    scope?: string;
  };
  if (!data.access_token) {
    throw new AppError(
      "GITHUB_ERROR",
      data.error_description || "GitHub authorization failed.",
      400,
    );
  }
  return data.access_token;
}
