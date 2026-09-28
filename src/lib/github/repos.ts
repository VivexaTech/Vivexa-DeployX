import "server-only";
import { githubFetch } from "@/lib/github/client";
import type { GithubBranch, GithubRepo, CommitInfo } from "@/lib/github/types";

type RawRepo = {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string; avatar_url: string };
  private: boolean;
  default_branch: string;
  updated_at: string;
  pushed_at: string | null;
  description: string | null;
  language: string | null;
};

const MAX_REPO_PAGES = 10;

export async function listRepositories(token: string, query = ""): Promise<GithubRepo[]> {
  const repos: RawRepo[] = [];
  for (let page = 1; page <= MAX_REPO_PAGES; page++) {
    const batch = await githubFetch<RawRepo[]>(
      token,
      `/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
    );
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  const q = query.trim().toLowerCase();
  return repos
    .filter((repo) => !q || repo.full_name.toLowerCase().includes(q))
    .map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      ownerAvatar: repo.owner.avatar_url,
      private: repo.private,
      defaultBranch: repo.default_branch,
      updatedAt: repo.pushed_at ?? repo.updated_at,
      description: repo.description,
      language: repo.language,
    }));
}

export async function getRepository(token: string, owner: string, repo: string): Promise<GithubRepo> {
  const raw = await githubFetch<RawRepo>(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  return {
    id: raw.id,
    name: raw.name,
    fullName: raw.full_name,
    owner: raw.owner.login,
    ownerAvatar: raw.owner.avatar_url,
    private: raw.private,
    defaultBranch: raw.default_branch,
    updatedAt: raw.pushed_at ?? raw.updated_at,
    description: raw.description,
    language: raw.language,
  };
}

export async function listBranches(token: string, owner: string, repo: string): Promise<GithubBranch[]> {
  const raw = await githubFetch<{ name: string; commit: { sha: string }; protected: boolean }[]>(
    token,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`,
  );
  return raw.map((b) => ({ name: b.name, sha: b.commit.sha, protected: b.protected }));
}

export async function getLatestCommit(token: string, owner: string, repo: string, ref: string): Promise<CommitInfo> {
  const raw = await githubFetch<{
    sha: string;
    commit: { message: string; author: { name: string } | null };
    author: { login: string } | null;
  }>(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(ref)}`);
  return {
    sha: raw.sha,
    message: raw.commit.message.split("\n")[0].slice(0, 200),
    author: raw.author?.login ?? raw.commit.author?.name ?? "unknown",
  };
}

/** Reads a file's text content, or null if it doesn't exist. */
export async function getFileText(
  token: string,
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<string | null> {
  try {
    const raw = await githubFetch<{ content?: string; encoding?: string }>(
      token,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path
        .split("/")
        .map(encodeURIComponent)
        .join("/")}?ref=${encodeURIComponent(ref)}`,
    );
    if (!raw.content || raw.encoding !== "base64") return null;
    return Buffer.from(raw.content, "base64").toString("utf8");
  } catch {
    return null;
  }
}

export async function listDirectory(
  token: string,
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<string[]> {
  try {
    const cleanPath = path.replace(/^\/+|\/+$/g, "");
    const raw = await githubFetch<{ name: string }[] | { name: string }>(
      token,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${cleanPath}?ref=${encodeURIComponent(ref)}`,
    );
    return Array.isArray(raw) ? raw.map((entry) => entry.name) : [];
  } catch {
    return [];
  }
}

/** Downloads the repository tarball (gzip) for a given ref. */
export async function downloadTarball(token: string, owner: string, repo: string, ref: string): Promise<Buffer> {
  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tarball/${encodeURIComponent(ref)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "Vivexa-DeployX",
      },
      redirect: "follow",
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error(`Failed to download repository archive (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}
