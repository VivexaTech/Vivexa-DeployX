"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Eye, EyeOff, GitBranch, KeyRound, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Switch } from "@/components/ui/input";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { EmptyState, ConfigNotice } from "@/components/ui/states";
import { CopyButton } from "@/components/ui/copy-button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { FRAMEWORKS, getFramework } from "@/lib/frameworks";
import { timeAgo } from "@/lib/utils";
import type { EnvironmentVariable, Project } from "@/types/database";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export function ProjectSettingsForm({ project }: { project: Project }) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: project.name,
    branch: project.branch,
    framework: project.framework,
    rootDirectory: project.root_directory,
    buildCommand: project.build_command ?? "",
    installCommand: project.install_command ?? "",
    outputDirectory: project.output_directory ?? "",
    autoDeploy: project.auto_deploy ?? true,
  });
  const preset = getFramework(form.framework);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await request(`/api/projects/${project.id}`, { method: "PATCH", body: JSON.stringify(form) });
      toast.success("Settings saved", "Changes apply to the next deployment.");
      router.refresh();
    } catch (error) {
      toast.error("Could not save settings", error instanceof Error ? error.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <form onSubmit={save}>
        <CardHeader title="Build & Development Settings" description="Changes take effect on the next deployment." />
        <div className="grid gap-5 p-5 md:grid-cols-2">
          <Field label="Project Name" htmlFor="s-name">
            <Input id="s-name" value={form.name} onChange={(e) => set({ name: e.target.value })} maxLength={60} required />
          </Field>
          <Field label="Production Branch" htmlFor="s-branch">
            <Input id="s-branch" value={form.branch} onChange={(e) => set({ branch: e.target.value })} required />
          </Field>
          <Field label="Framework" htmlFor="s-framework">
            <Select id="s-framework" value={form.framework} onChange={(e) => set({ framework: e.target.value })}>
              {FRAMEWORKS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Root Directory" htmlFor="s-root">
            <Input id="s-root" value={form.rootDirectory} onChange={(e) => set({ rootDirectory: e.target.value })} placeholder="./" />
          </Field>
          <Field label="Build Command" htmlFor="s-build">
            <Input id="s-build" value={form.buildCommand} onChange={(e) => set({ buildCommand: e.target.value })} placeholder={preset.buildCommand ?? "Default"} className="font-mono text-[13px]" />
          </Field>
          <Field label="Install Command" htmlFor="s-install">
            <Input id="s-install" value={form.installCommand} onChange={(e) => set({ installCommand: e.target.value })} placeholder={preset.installCommand ?? "Default"} className="font-mono text-[13px]" />
          </Field>
          <Field label="Output Directory" htmlFor="s-output">
            <Input id="s-output" value={form.outputDirectory} onChange={(e) => set({ outputDirectory: e.target.value })} placeholder={preset.outputDirectory ?? "Default"} className="font-mono text-[13px]" />
          </Field>
          <div className="flex items-center pt-2 md:col-span-2">
            <Switch
              checked={form.autoDeploy}
              onChange={(val) => set({ autoDeploy: val })}
              label="Automatic Git Deployments (deploy on push to production branch)"
            />
          </div>
        </div>
        <CardFooter className="justify-end">
          <Button type="submit" loading={saving}>
            Save changes
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

type EnvRow = Pick<EnvironmentVariable, "id" | "key" | "is_secret" | "targets" | "updated_at">;

function omit(record: Record<string, string>, key: string): Record<string, string> {
  const next = { ...record };
  delete next[key];
  return next;
}

export function EnvVarManager({
  projectId,
  initial,
  encryptionConfigured,
}: {
  projectId: string;
  initial: EnvRow[];
  encryptionConfigured: boolean;
}) {
  const toast = useToast();
  const [rows, setRows] = useState<EnvRow[]>(initial);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<EnvRow | null>(null);
  const [busy, setBusy] = useState(false);

  const reveal = async (row: EnvRow) => {
    if (revealed[row.id] !== undefined) {
      setRevealed((r) => omit(r, row.id));
      return;
    }
    try {
      const data = await request<{ value: string }>(`/api/projects/${projectId}/env/${row.id}`);
      setRevealed((r) => ({ ...r, [row.id]: data.value }));
    } catch (error) {
      toast.error("Could not reveal value", error instanceof Error ? error.message : undefined);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await request(`/api/projects/${projectId}/env`, { method: "DELETE", body: JSON.stringify({ envId: deleting.id }) });
      setRows((r) => r.filter((x) => x.id !== deleting.id));
      toast.success("Variable deleted", "Redeploy to apply the change.");
      setDeleting(null);
    } catch (error) {
      toast.error("Could not delete variable", error instanceof Error ? error.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Environment Variables"
        description="Values are encrypted at rest and injected at build and runtime. Redeploy to apply changes."
        action={
          <Button size="sm" variant="outline" onClick={() => setAdding(true)} disabled={!encryptionConfigured}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        }
      />
      {!encryptionConfigured && (
        <div className="p-5 pb-0">
          <ConfigNotice title="Encryption key missing" description="ENCRYPTION_KEY is not configured, so environment variables can't be stored or revealed." />
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState icon={<KeyRound className="h-5 w-5" />} title="No environment variables" description="Add API keys, database URLs and other configuration." />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => {
            const value = revealed[row.id];
            return (
              <li key={row.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="truncate font-mono text-[13px] font-medium text-foreground">{row.key}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {row.targets.map((t) => (
                      <Badge key={t} tone="neutral" className="capitalize">
                        {t}
                      </Badge>
                    ))}
                    <span className="text-xs text-muted-soft">Updated {timeAgo(row.updated_at)}</span>
                  </div>
                </div>
                <code className="min-w-0 flex-1 basis-48 truncate rounded-md bg-background-subtle px-2.5 py-1.5 font-mono text-xs text-muted">
                  {value !== undefined ? value || "(empty)" : "••••••••••••"}
                </code>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => reveal(row)}
                    disabled={!encryptionConfigured}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-background-subtle hover:text-foreground disabled:opacity-40"
                    aria-label={value !== undefined ? "Hide value" : "Reveal value"}
                    title={value !== undefined ? "Hide value" : "Reveal value"}
                  >
                    {value !== undefined ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  {value !== undefined && <CopyButton value={value} label="Copy value" />}
                  <button
                    type="button"
                    onClick={() => setDeleting(row)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                    aria-label={`Delete ${row.key}`}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <AddEnvDialog
        open={adding}
        onClose={() => setAdding(false)}
        projectId={projectId}
        onSaved={(row) => {
          setRows((r) => [...r.filter((x) => x.key !== row.key), row].sort((a, b) => a.key.localeCompare(b.key)));
          setRevealed((r) => omit(r, row.id));
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={busy}
        danger
        title="Delete environment variable"
        description={deleting ? `${deleting.key} will be removed from this project and the next deployment.` : undefined}
        confirmLabel="Delete"
      />
    </Card>
  );
}

const TARGETS = ["production", "preview", "development"] as const;

function AddEnvDialog({
  open,
  onClose,
  projectId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onSaved: (row: EnvRow) => void;
}) {
  const toast = useToast();
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [isSecret, setIsSecret] = useState(true);
  const [targets, setTargets] = useState<string[]>(["production", "preview"]);
  const [saving, setSaving] = useState(false);
  const validKey = /^[A-Za-z_][A-Za-z0-9_]*$/.test(key.trim());

  const save = async () => {
    setSaving(true);
    try {
      const data = await request<{ variable: EnvRow }>(`/api/projects/${projectId}/env`, {
        method: "POST",
        body: JSON.stringify({ key: key.trim(), value, isSecret, targets }),
      });
      onSaved(data.variable);
      toast.success("Variable saved", "Redeploy to apply the change.");
      setKey("");
      setValue("");
      onClose();
    } catch (error) {
      toast.error("Could not save variable", error instanceof Error ? error.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add environment variable"
      description="Saving an existing key overwrites its value."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={!validKey || targets.length === 0}>
            <Check className="h-4 w-4" /> Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Key" htmlFor="env-key" error={key && !validKey ? "Use letters, numbers and underscores; don't start with a number." : null}>
          <Input id="env-key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="DATABASE_URL" className="font-mono text-[13px]" autoComplete="off" />
        </Field>
        <Field label="Value" htmlFor="env-value">
          <Input id="env-value" type="password" value={value} onChange={(e) => setValue(e.target.value)} className="font-mono text-[13px]" autoComplete="off" />
        </Field>
        <div>
          <p className="mb-2 text-[13px] font-medium text-foreground">Environments</p>
          <div className="flex flex-wrap gap-4">
            {TARGETS.map((t) => (
              <label key={t} className="flex items-center gap-2 text-[13px] capitalize text-foreground">
                <input
                  type="checkbox"
                  checked={targets.includes(t)}
                  onChange={(e) => setTargets((cur) => (e.target.checked ? [...cur, t] : cur.filter((x) => x !== t)))}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                {t}
              </label>
            ))}
          </div>
        </div>
        <Switch checked={isSecret} onChange={setIsSecret} label="Sensitive value" />
      </div>
    </Dialog>
  );
}

export function DeleteProject({ projectId, projectName }: { projectId: string; projectName: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const remove = async () => {
    setLoading(true);
    try {
      await request(`/api/projects/${projectId}`, { method: "DELETE" });
      toast.success("Project deleted");
      router.push("/dashboard/projects");
      router.refresh();
    } catch (error) {
      toast.error("Could not delete project", error instanceof Error ? error.message : undefined);
      setLoading(false);
    }
  };

  return (
    <Card className="border-danger/30">
      <CardHeader title="Delete Project" description="Permanently removes this project, its deployments, domains and environment variables. This cannot be undone." />
      <CardFooter className="justify-end border-danger/20 bg-danger-soft/40">
        <Button variant="danger" onClick={() => setOpen(true)}>
          <Trash2 className="h-4 w-4" /> Delete project
        </Button>
      </CardFooter>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete project"
        description="This removes the project from DeployX and deletes the linked infrastructure project."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="danger" onClick={remove} loading={loading} disabled={confirm !== projectName}>
              Delete
            </Button>
          </>
        }
      >
        <Field label={`Type "${projectName}" to confirm`} htmlFor="confirm-delete">
          <Input id="confirm-delete" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        </Field>
      </Dialog>
    </Card>
  );
}

export function GitWebhookSettings({ project }: { project: Project }) {
  const router = useRouter();
  const toast = useToast();
  const [configuring, setConfiguring] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [autoDeploy, setAutoDeploy] = useState(project.auto_deploy ?? true);
  const [toggling, setToggling] = useState(false);

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/webhooks/github?projectId=${project.id}`
      : `/api/webhooks/github?projectId=${project.id}`;

  const secret = project.webhook_secret || "Configured automatically on server";

  const toggleAutoDeploy = async (enabled: boolean) => {
    setAutoDeploy(enabled);
    setToggling(true);
    try {
      await request(`/api/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: project.name,
          branch: project.branch,
          framework: project.framework,
          rootDirectory: project.root_directory,
          autoDeploy: enabled,
        }),
      });
      toast.success(
        enabled ? "Automatic deployments enabled" : "Automatic deployments paused",
        `Pushes to ${project.branch} will ${enabled ? "now trigger builds" : "no longer trigger builds"}.`,
      );
      router.refresh();
    } catch (err) {
      toast.error("Could not update auto deploy setting", err instanceof Error ? err.message : undefined);
      setAutoDeploy(!enabled);
    } finally {
      setToggling(false);
    }
  };

  const autoConfigure = async () => {
    setConfiguring(true);
    try {
      const res = await request<{ ok: boolean; message: string }>(`/api/projects/${project.id}/webhook`, {
        method: "POST",
      });
      toast.success("Webhook configured on GitHub", res.message);
      router.refresh();
    } catch (err) {
      toast.error(
        "Automatic webhook setup failed",
        err instanceof Error ? err.message : "You can configure it manually on GitHub below.",
      );
    } finally {
      setConfiguring(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Git & Webhooks"
        description="Configure automatic deployments for pushes to your connected GitHub repository."
        action={
          <Badge tone={autoDeploy ? "success" : "neutral"} dot>
            {autoDeploy ? "Auto-Deploy Enabled" : "Auto-Deploy Disabled"}
          </Badge>
        }
      />
      <div className="space-y-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-background-subtle p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Automatic Deployment on Git Push</p>
            <p className="text-xs text-muted">
              Trigger a new build whenever code is pushed to{" "}
              <span className="inline-flex items-center gap-1 font-mono text-accent">
                <GitBranch className="h-3 w-3" /> {project.branch}
              </span>
            </p>
          </div>
          <Switch
            label={autoDeploy ? "Enabled" : "Disabled"}
            checked={autoDeploy}
            onChange={toggleAutoDeploy}
            disabled={toggling}
          />
        </div>

        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[13px] font-medium text-foreground">Payload URL</span>
              <CopyButton value={webhookUrl} label="Copy URL" />
            </div>
            <Input value={webhookUrl} readOnly className="bg-background-subtle font-mono text-xs" />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[13px] font-medium text-foreground">Webhook Secret</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
                >
                  {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showSecret ? "Hide" : "Reveal"}
                </button>
                <CopyButton value={secret} label="Copy Secret" />
              </div>
            </div>
            <Input
              type={showSecret ? "text" : "password"}
              value={secret}
              readOnly
              className="bg-background-subtle font-mono text-xs"
            />
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-border/80 bg-background-subtle p-4 text-xs text-muted">
          <p className="font-medium text-foreground">GitHub Webhook Instructions:</p>
          <ul className="list-inside list-disc space-y-1 text-muted-soft">
            <li>
              Payload URL: <span className="font-mono text-foreground">{webhookUrl}</span>
            </li>
            <li>
              Content type: <span className="font-mono text-foreground">application/json</span>
            </li>
            <li>
              Secret: <span className="font-mono text-foreground">{showSecret ? secret : "••••••••••••"}</span>
            </li>
            <li>
              Events: <span className="font-mono text-foreground">Just the push event</span>
            </li>
          </ul>
        </div>
      </div>
      <CardFooter className="justify-between border-t border-border">
        <a
          href={`https://github.com/${project.repo_owner}/${project.repo_name}/settings/hooks`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
        >
          Open GitHub Webhook Settings <ExternalLink className="h-3 w-3" />
        </a>
        <Button onClick={autoConfigure} loading={configuring} size="sm" variant="outline">
          <RefreshCw className="h-3.5 w-3.5" /> Auto-Configure on GitHub
        </Button>
      </CardFooter>
    </Card>
  );
}

