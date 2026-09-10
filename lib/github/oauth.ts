import { getAppUrl, readEnv, requireServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { signValue, verifySignedValue } from "@/lib/crypto";

const GITHUB_AUTHORIZE = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN = "https://github.com/login/oauth/access_token";

export function githubConfigured() {
  return Boolean(readEnv("GITHUB_CLIENT_ID") && readEnv("GITHUB_CLIENT_SECRET"));
}

export function createGithubState(uid: string) {
  const payload = JSON.stringify({ uid, exp: Date.now() + 10 * 60 * 1000 });
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
  const parsed = JSON.parse(payload) as { uid: string; exp: number };
  if (parsed.exp < Date.now()) {
    throw new AppError("VALIDATION", "GitHub authorization expired. Please try again.", 400);
  }
  return parsed;
}

export function getGithubAuthorizeUrl(uid: string) {
  requireServerEnv(["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"]);
  const params = new URLSearchParams({
    client_id: readEnv("GITHUB_CLIENT_ID"),
    redirect_uri: `${getAppUrl()}/api/github/callback`,
    scope: "repo read:user",
    state: createGithubState(uid),
    allow_signup: "false",
  });
  return `${GITHUB_AUTHORIZE}?${params.toString()}`;
}

export async function exchangeGithubCode(code: string) {
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
      redirect_uri: `${getAppUrl()}/api/github/callback`,
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
