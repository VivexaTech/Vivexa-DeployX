import { NextResponse } from "next/server";
import { z } from "zod";
import { withUser } from "@/lib/security/api";
import { getUserGithubToken } from "@/lib/github/client";
import { listBranches } from "@/lib/github/repos";

export const dynamic = "force-dynamic";

const name = z.string().min(1).max(100).regex(/^[A-Za-z0-9_.-]+$/);

export const GET = withUser(
  { schema: z.object({ owner: name, repo: name }), rateLimit: { key: "gh-branches", limit: 60, windowMs: 60_000 } },
  async ({ user, body }) => {
    const token = await getUserGithubToken(user.id);
    const branches = await listBranches(token, body.owner, body.repo);
    return NextResponse.json({ branches });
  },
);
