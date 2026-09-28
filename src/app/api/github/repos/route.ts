import { NextResponse } from "next/server";
import { z } from "zod";
import { withUser } from "@/lib/security/api";
import { getUserGithubToken, logGithub } from "@/lib/github/client";
import { listRepositories } from "@/lib/github/repos";

export const dynamic = "force-dynamic";

export const GET = withUser(
  { schema: z.object({ q: z.string().max(100).optional() }), rateLimit: { key: "gh-repos", limit: 60, windowMs: 60_000 } },
  async ({ user, body }) => {
    const token = await getUserGithubToken(user.id);
    const repos = await listRepositories(token, body.q ?? "");
    logGithub("info", "repositories_listed", { userId: user.id, count: repos.length });
    return NextResponse.json({ repos });
  },
);
