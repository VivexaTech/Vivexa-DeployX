import { NextResponse } from "next/server";
import { z } from "zod";
import { withUser } from "@/lib/security/api";
import { getUserGithubToken } from "@/lib/github/client";
import { getFileText, listDirectory } from "@/lib/github/repos";
import { detectFramework, getFramework } from "@/lib/frameworks";

export const dynamic = "force-dynamic";

const name = z.string().min(1).max(100).regex(/^[A-Za-z0-9_.-]+$/);

export const GET = withUser(
  {
    schema: z.object({
      owner: name,
      repo: name,
      branch: z.string().min(1).max(255),
      root: z
        .string()
        .max(255)
        .regex(/^[A-Za-z0-9_./-]*$/)
        .refine((v) => !v.includes(".."), "Invalid root directory")
        .optional(),
    }),
    rateLimit: { key: "gh-detect", limit: 30, windowMs: 60_000 },
  },
  async ({ user, body }) => {
    const token = await getUserGithubToken(user.id);
    const root = (body.root ?? "").replace(/^\/+|\/+$/g, "");
    const [pkg, files] = await Promise.all([
      getFileText(token, body.owner, body.repo, root ? `${root}/package.json` : "package.json", body.branch),
      listDirectory(token, body.owner, body.repo, root, body.branch),
    ]);
    const framework = getFramework(detectFramework(pkg, files));
    return NextResponse.json({ framework, hasPackageJson: pkg !== null });
  },
);
