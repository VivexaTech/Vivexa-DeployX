import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { Alert } from "@/components/ui/states";
import { NewProjectWizard } from "@/components/deployment/new-project-wizard";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getIntegrationStatus } from "@/lib/env";
import { getUsageSnapshot } from "@/lib/data/limits";

export const metadata: Metadata = { title: "New Project" };

const GITHUB_MESSAGES: Record<string, { tone: "success" | "danger" | "warning"; text: string }> = {
  connected: { tone: "success", text: "GitHub connected. Choose a repository to import." },
  denied: { tone: "warning", text: "GitHub authorization was cancelled." },
  state: { tone: "danger", text: "GitHub authorization expired or was invalid. Please try again." },
  exchange: { tone: "danger", text: "GitHub rejected the authorization code. Please try connecting again." },
  error: { tone: "danger", text: "Could not read your GitHub profile. Please try again." },
  database: { tone: "danger", text: "Your GitHub connection could not be saved. Check the database configuration and server logs." },
  callback: {
    tone: "danger",
    text: "GitHub is misconfigured: GITHUB_CALLBACK_URL and the GitHub OAuth app's callback URL must point to /api/github/callback.",
  },
  unconfigured: { tone: "warning", text: "GitHub integration is not configured on this server." },
  encryption: { tone: "warning", text: "ENCRYPTION_KEY is not configured, so GitHub tokens can't be stored securely." },
};

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ github?: string }> }) {
  const user = await requireUser();
  const { github } = await searchParams;
  const supabase = await createClient();
  const status = getIntegrationStatus();

  const [{ data: connection }, usage] = await Promise.all([
    supabase.from("github_connections").select("username").eq("user_id", user.id).maybeSingle(),
    getUsageSnapshot(user.id),
  ]);

  let limitMessage: string | null = null;
  if (!usage.plan) {
    limitMessage = "You don't have an active plan. Choose a plan from Billing to create projects.";
  } else if (usage.plan.max_projects !== null && usage.projects >= usage.plan.max_projects) {
    limitMessage = `You've reached the ${usage.plan.name} plan limit of ${usage.plan.max_projects} projects.`;
  }

  const message = github ? GITHUB_MESSAGES[github] : undefined;

  return (
    <>
      <PageHeader
        title="New Project"
        description="Import a Git repository and deploy it in a few steps."
        breadcrumb={[{ label: "Projects", href: "/dashboard/projects" }, { label: "New" }]}
      />
      {message && (
        <Alert tone={message.tone} className="mb-6">
          {message.text}
        </Alert>
      )}
      <NewProjectWizard
        githubConfigured={status.github}
        githubUsername={(connection as { username: string } | null)?.username ?? null}
        vercelConfigured={status.vercel}
        encryptionConfigured={status.encryption}
        limitMessage={limitMessage}
      />
    </>
  );
}
