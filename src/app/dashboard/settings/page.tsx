import type { Metadata } from "next";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, PageHeader } from "@/components/ui/misc";
import { Alert, ConfigNotice } from "@/components/ui/states";
import { GithubIcon } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { GithubDisconnectButton, PasswordForm, ProfileForm } from "@/components/dashboard/settings-forms";
import { changePasswordAction, updateProfileAction } from "./actions";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getIntegrationStatus } from "@/lib/env";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Settings" };

const GITHUB_MESSAGES: Record<string, { tone: "success" | "danger" | "warning"; text: string }> = {
  connected: { tone: "success", text: "GitHub connected successfully." },
  denied: { tone: "warning", text: "GitHub authorization was cancelled." },
  state: { tone: "danger", text: "GitHub authorization expired or was invalid. Please try again." },
  error: { tone: "danger", text: "Could not connect GitHub. Please try again." },
  unconfigured: { tone: "warning", text: "GitHub integration is not configured on this server." },
  encryption: { tone: "warning", text: "ENCRYPTION_KEY is not configured, so GitHub tokens can't be stored securely." },
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ github?: string }> }) {
  const user = await requireUser();
  const { github } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("github_connections").select("username, avatar_url, created_at").eq("user_id", user.id).maybeSingle();
  const connection = data as { username: string; avatar_url: string | null; created_at: string } | null;
  const status = getIntegrationStatus();
  const message = github ? GITHUB_MESSAGES[github] : undefined;

  return (
    <>
      <PageHeader title="Settings" description="Manage your account, connections and preferences." />
      {message && (
        <Alert tone={message.tone} className="mb-6">
          {message.text}
        </Alert>
      )}
      <div className="max-w-3xl space-y-6">
        <Card>
          <CardHeader title="Profile" />
          <CardContent>
            <div className="mb-5 flex items-center gap-3">
              <Avatar name={user.profile.name} email={user.email} src={user.profile.avatar_url} size={48} />
              <div>
                <p className="text-sm font-medium text-foreground">{user.profile.name ?? user.email}</p>
                <p className="text-xs text-muted">Member since {formatDate(user.profile.created_at)}</p>
              </div>
            </div>
            <ProfileForm action={updateProfileAction} name={user.profile.name ?? ""} avatarUrl={user.profile.avatar_url ?? ""} email={user.email} />
          </CardContent>
        </Card>

        <Card id="github" className="scroll-mt-24">
          <CardHeader title="GitHub" description="Used to list repositories and download source code for deployments." />
          <CardContent>
            {!status.github ? (
              <ConfigNotice title="GitHub integration unavailable" description="Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to enable GitHub connections." />
            ) : connection ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={connection.username} src={connection.avatar_url} size={36} />
                  <div>
                    <p className="text-sm font-medium text-foreground">@{connection.username}</p>
                    <p className="text-xs text-muted">Connected {formatDate(connection.created_at)}</p>
                  </div>
                </div>
                <GithubDisconnectButton />
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] text-muted">No GitHub account connected.</p>
                <a
                  href="/api/github/connect?next=/dashboard/settings"
                  className="inline-flex h-8 items-center gap-2 rounded-lg bg-foreground px-3 text-[13px] font-medium text-background hover:opacity-90"
                >
                  <GithubIcon className="h-4 w-4" /> Connect GitHub
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Password" />
          <CardContent>
            <PasswordForm action={changePasswordAction} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Appearance" />
          <CardContent className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-muted">Choose light, dark, or follow your system setting.</p>
            <ThemeToggle />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
