import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { getAdminDb } from "@/lib/firebase/admin";
import { collections } from "@/lib/firebase/collections";
import { nowIso } from "@/lib/utils";
import type { GithubRepo } from "@/types";

const GITHUB_API = "https://api.github.com";

export async function storeGithubToken(uid: string, token: string, login?: string) {
  const db = getAdminDb();
  await db.collection(collections.githubConnections).doc(uid).set({
    uid,
    login: login ?? null,
    tokenEncrypted: encryptSecret(token),
    connectedAt: nowIso(),
    updatedAt: nowIso(),
  });
}

export async function getGithubToken(uid: string) {
  const db = getAdminDb();
  const snap = await db.collection(collections.githubConnections).doc(uid).get();
  if (!snap.exists) {
    throw new AppError("GITHUB_ERROR", "Connect GitHub to continue.", 409);
  }
  return decryptSecret(String(snap.data()?.tokenEncrypted ?? ""));
}

export async function getGithubConnection(uid: string) {
  const db = getAdminDb();
  const snap = await db.collection(collections.githubConnections).doc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  return {
    connected: true,
    login: (data.login as string | null) ?? null,
    connectedAt: String(data.connectedAt ?? ""),
  };
}

export async function deleteGithubConnection(uid: string) {
  const db = getAdminDb();
  await db.collection(collections.githubConnections).doc(uid).delete();
}

async function githubFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Vivexa-DeployX",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (response.status === 401 || response.status === 403) {
    const body = await response.json().catch(() => ({}));
    const message =
      response.status === 401
        ? "GitHub authorization expired or was revoked. Reconnect GitHub."
        : (body as { message?: string }).message?.includes("rate limit")
          ? "GitHub rate limit reached. Please wait and try again."
          : "GitHub denied this request. Check repository access and try again.";
    throw new AppError("GITHUB_ERROR", message, response.status === 401 ? 409 : 429);
  }
  if (!response.ok) {
    throw new AppError("GITHUB_ERROR", "GitHub is unavailable right now. Please retry.", 502);
  }
  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

export async function getGithubUser(token: string) {
  return githubFetch<{ login: string; id: number }>(token, "/user");
}

export async function listGithubRepos(uid: string): Promise<GithubRepo[]> {
  const token = await getGithubToken(uid);
  const repos = await githubFetch<
    {
      id: number;
      name: string;
      full_name: string;
      private: boolean;
      description: string | null;
      default_branch: string;
      html_url: string;
      updated_at: string;
      language: string | null;
    }[]
  >(token, "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member");
  return repos.map((repo) => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    private: repo.private,
    description: repo.description,
    defaultBranch: repo.default_branch,
    htmlUrl: repo.html_url,
    updatedAt: repo.updated_at,
    language: repo.language,
  }));
}

export async function listGithubBranches(uid: string, owner: string, repo: string) {
  const token = await getGithubToken(uid);
  const branches = await githubFetch<{ name: string }[]>(
    token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`,
  );
  return branches.map((branch) => branch.name);
}

export async function getLatestCommit(uid: string, owner: string, repo: string, branch: string) {
  const token = await getGithubToken(uid);
  try {
    const data = await githubFetch<{ sha: string; commit: { message: string } }>(
      token,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(branch)}`,
    );
    return { sha: data.sha, message: data.commit.message };
  } catch {
    return { sha: null, message: null };
  }
}

export async function ensureRepoWebhook(uid: string, owner: string, repo: string, hookUrl: string, secret: string) {
  const token = await getGithubToken(uid);
  const hooks = await githubFetch<{ id: number; config?: { url?: string } }[]>(
    token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks`,
  );
  const existing = hooks.find((hook) => hook.config?.url === hookUrl);
  if (existing) return existing.id;
  const created = await githubFetch<{ id: number }>(
    token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks`,
    {
      method: "POST",
      body: JSON.stringify({
        name: "web",
        active: true,
        events: ["push"],
        config: {
          url: hookUrl,
          content_type: "json",
          secret,
          insecure_ssl: "0",
        },
      }),
    },
  );
  return created.id;
}
