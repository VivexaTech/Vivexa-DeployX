"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  Globe2,
  Lock,
  Plus,
  Search,
  Trash2,
  Wand2,
  XCircle,
} from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, ConfigNotice, EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { GithubIcon } from "@/components/ui/icons";
import { GithubDisconnectButton } from "@/components/dashboard/settings-forms";
import { LogViewer } from "@/components/deployment/log-viewer";
import { useToast } from "@/components/ui/toast";
import { FRAMEWORKS, getFramework, type FrameworkPreset } from "@/lib/frameworks";
import type { GithubBranch, GithubRepo } from "@/lib/github/types";
import { cn, timeAgo } from "@/lib/utils";
import type { DeploymentStatus } from "@/types/database";

const STEPS = ["Select Repository", "Configure Project", "Environment Variables", "Review", "Deploy"];

type Config = {
  name: string;
  branch: string;
  framework: string;
  rootDirectory: string;
  buildCommand: string;
  installCommand: string;
  outputDirectory: string;
};

type EnvRow = { id: number; key: string; value: string };

type Props = {
  githubConfigured: boolean;
  githubUsername: string | null;
  vercelConfigured: boolean;
  encryptionConfigured: boolean;
  limitMessage: string | null;
};

let envCounter = 0;

export function NewProjectWizard({ githubConfigured, githubUsername, vercelConfigured, encryptionConfigured, limitMessage }: Props) {
  const [step, setStep] = useState(0);
  const [repo, setRepo] = useState<GithubRepo | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [envRows, setEnvRows] = useState<EnvRow[]>([]);

  if (!githubConfigured) {
    return (
      <ConfigNotice
        title="GitHub integration unavailable"
        description="GitHub integration is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to enable repository imports."
      />
    );
  }

  if (!githubUsername) {
    return (
      <Card>
        <EmptyState
          icon={<GithubIcon className="h-5 w-5" />}
          title="Connect your GitHub account"
          description="DeployX needs access to your repositories to import and deploy them. Your token is encrypted and used only on our servers."
          action={
            <a href="/api/github/connect?next=/dashboard/projects/new" className="inline-flex h-9 items-center gap-2 rounded-lg bg-foreground px-4 text-sm font-medium text-background hover:opacity-90">
              <GithubIcon /> Connect GitHub
            </a>
          }
        />
      </Card>
    );
  }

  return (
    <div>
      <Stepper step={step} />
      {limitMessage && step < 4 && (
        <Alert tone="warning" className="mb-6">
          {limitMessage}{" "}
          <Link href="/dashboard/billing" className="font-medium underline">
            Upgrade plan
          </Link>
        </Alert>
      )}
      {step === 0 && (
        <RepoStep
          username={githubUsername}
          onSelect={(r) => {
            setRepo(r);
            setConfig({
              name: r.name,
              branch: r.defaultBranch,
              framework: "other",
              rootDirectory: "",
              buildCommand: "",
              installCommand: "",
              outputDirectory: "",
            });
            setStep(1);
          }}
        />
      )}
      {step === 1 && repo && config && (
        <ConfigureStep repo={repo} config={config} onChange={setConfig} onBack={() => setStep(0)} onNext={() => setStep(2)} />
      )}
      {step === 2 && (
        <EnvStep rows={envRows} onChange={setEnvRows} encryptionConfigured={encryptionConfigured} onBack={() => setStep(1)} onNext={() => setStep(3)} />
      )}
      {step === 3 && repo && config && (
        <ReviewStep
          repo={repo}
          config={config}
          envCount={envRows.filter((r) => r.key.trim()).length}
          vercelConfigured={vercelConfigured}
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      )}
      {step === 4 && repo && config && <DeployStep repo={repo} config={config} envRows={envRows} onBack={() => setStep(3)} />}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mb-8 flex items-center gap-2 overflow-x-auto pb-1" aria-label="Progress">
      {STEPS.map((label, i) => (
        <li key={label} className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium transition-colors",
              i < step && "border-foreground bg-foreground text-background",
              i === step && "border-foreground text-foreground",
              i > step && "border-border text-muted-soft",
            )}
            aria-current={i === step ? "step" : undefined}
          >
            {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <span className={cn("text-[13px]", i === step ? "font-medium text-foreground" : "text-muted")}>{label}</span>
          {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-border sm:w-10" />}
        </li>
      ))}
    </ol>
  );
}

function RepoStep({ username, onSelect }: { username: string; onSelect: (repo: GithubRepo) => void }) {
  const [query, setQuery] = useState("");
  const [repos, setRepos] = useState<GithubRepo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/github/repos", { cache: "no-store" });
      const data = (await res.json()) as { repos?: GithubRepo[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load repositories");
      setRepos(data.repos ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load repositories");
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(load, 0);
    return () => clearTimeout(id);
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (repos ?? []).filter((r) => !q || r.fullName.toLowerCase().includes(q));
  }, [repos, query]);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background-subtle">
            <GithubIcon className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" /> GitHub Connected
            </p>
            <p className="text-xs text-muted">@{username}</p>
          </div>
        </div>
        <GithubDisconnectButton />
      </div>
      <div className="border-b border-border p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-soft" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search repositories…" className="pl-9" aria-label="Search repositories" autoFocus />
        </div>
      </div>
      {error ? (
        <ErrorState
          title="Couldn't load repositories"
          description={error}
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={load}>Retry</Button>
              <a
                href="/api/github/connect?next=/dashboard/projects/new"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-background-subtle"
              >
                <GithubIcon /> Reconnect GitHub
              </a>
            </div>
          }
        />
      ) : repos === null ? (
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="ml-auto h-8 w-20" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={query ? "No matching repositories" : "No repositories found."}
          description={
            query
              ? `No repositories match “${query}”.`
              : "Make sure your GitHub account has repositories available to the authorized application."
          }
        />
      ) : (
        <ul className="scrollbar-thin max-h-[520px] divide-y divide-border overflow-y-auto">
          {filtered.map((repo) => (
            <li key={repo.id} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-background-subtle">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{repo.name}</span>
                  <Badge tone={repo.private ? "neutral" : "info"}>
                    {repo.private ? <Lock className="h-3 w-3" /> : <Globe2 className="h-3 w-3" />}
                    {repo.private ? "Private" : "Public"}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                  <span>{repo.owner}</span>
                  <span className="flex items-center gap-1">
                    <GitBranch className="h-3 w-3" /> {repo.defaultBranch}
                  </span>
                  <span>Updated {timeAgo(repo.updatedAt)}</span>
                </div>
              </div>
              <Button size="sm" onClick={() => onSelect(repo)}>
                Import
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ConfigureStep({
  repo,
  config,
  onChange,
  onBack,
  onNext,
}: {
  repo: GithubRepo;
  config: Config;
  onChange: (c: Config) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [branches, setBranches] = useState<GithubBranch[] | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<FrameworkPreset | null>(null);
  const set = (patch: Partial<Config>) => onChange({ ...config, ...patch });

  useEffect(() => {
    fetch(`/api/github/branches?owner=${encodeURIComponent(repo.owner)}&repo=${encodeURIComponent(repo.name)}`)
      .then((r) => r.json())
      .then((d: { branches?: GithubBranch[] }) => setBranches(d.branches ?? []))
      .catch(() => setBranches([]));
  }, [repo]);

  const detect = useCallback(
    async (branch: string, root: string) => {
      setDetecting(true);
      try {
        const params = new URLSearchParams({ owner: repo.owner, repo: repo.name, branch, root });
        const res = await fetch(`/api/github/detect?${params.toString()}`);
        const data = (await res.json()) as { framework?: FrameworkPreset };
        if (res.ok && data.framework) {
          setDetected(data.framework);
          onChange({ ...config, branch, rootDirectory: root, framework: data.framework.id });
        }
      } finally {
        setDetecting(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- detection runs on explicit triggers only
    [repo],
  );

  useEffect(() => {
    const id = setTimeout(() => detect(config.branch, config.rootDirectory), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial detection only
  }, []);

  const preset = getFramework(config.framework);
  const valid = config.name.trim().length > 0 && config.branch.trim().length > 0;

  return (
    <Card>
      <div className="grid gap-5 p-5 md:grid-cols-2">
        <Field label="Project Name" htmlFor="name" className="md:col-span-2">
          <Input id="name" value={config.name} onChange={(e) => set({ name: e.target.value })} maxLength={60} />
        </Field>
        <Field label="Repository" htmlFor="repo">
          <Input id="repo" value={repo.fullName} readOnly disabled />
        </Field>
        <Field label="Branch" htmlFor="branch">
          {branches && branches.length > 0 ? (
            <Select id="branch" value={config.branch} onChange={(e) => detect(e.target.value, config.rootDirectory)}>
              {branches.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                </option>
              ))}
            </Select>
          ) : (
            <Input id="branch" value={config.branch} onChange={(e) => set({ branch: e.target.value })} />
          )}
        </Field>
        <Field
          label="Framework"
          htmlFor="framework"
          hint={detecting ? "Detecting framework…" : detected ? `Detected: ${detected.name}` : "Choose manually if detection is wrong."}
        >
          <Select id="framework" value={config.framework} onChange={(e) => set({ framework: e.target.value })}>
            {FRAMEWORKS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Root Directory" htmlFor="root" hint="Leave empty for the repository root.">
          <div className="flex gap-2">
            <Input id="root" value={config.rootDirectory} onChange={(e) => set({ rootDirectory: e.target.value })} placeholder="./" />
            <Button variant="outline" onClick={() => detect(config.branch, config.rootDirectory)} loading={detecting} aria-label="Re-detect framework" title="Re-detect framework">
              {!detecting && <Wand2 className="h-4 w-4" />}
            </Button>
          </div>
        </Field>
        <Field label="Build Command" htmlFor="build" hint="Optional override.">
          <Input id="build" value={config.buildCommand} onChange={(e) => set({ buildCommand: e.target.value })} placeholder={preset.buildCommand ?? "npm run build"} className="font-mono text-[13px]" />
        </Field>
        <Field label="Install Command" htmlFor="install" hint="Optional override.">
          <Input id="install" value={config.installCommand} onChange={(e) => set({ installCommand: e.target.value })} placeholder={preset.installCommand ?? "npm install"} className="font-mono text-[13px]" />
        </Field>
        <Field label="Output Directory" htmlFor="output" hint="Optional override." className="md:col-span-2">
          <Input id="output" value={config.outputDirectory} onChange={(e) => set({ outputDirectory: e.target.value })} placeholder={preset.outputDirectory ?? "auto"} className="font-mono text-[13px]" />
        </Field>
      </div>
      <StepFooter onBack={onBack} onNext={onNext} nextDisabled={!valid} />
    </Card>
  );
}

function parseDotEnv(text: string): { key: string; value: string }[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const idx = line.indexOf("=");
      const key = line.slice(0, idx).replace(/^export\s+/, "").trim();
      const value = line.slice(idx + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
      return { key, value };
    });
}

function EnvStep({
  rows,
  onChange,
  encryptionConfigured,
  onBack,
  onNext,
}: {
  rows: EnvRow[];
  onChange: (rows: EnvRow[]) => void;
  encryptionConfigured: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const [paste, setPaste] = useState("");
  const keyPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const invalid = rows.some((r) => r.key.trim() && !keyPattern.test(r.key.trim()));
  const keys = rows.map((r) => r.key.trim()).filter(Boolean);
  const duplicate = keys.length !== new Set(keys).size;

  return (
    <Card>
      <div className="space-y-4 p-5">
        <p className="text-[13px] text-muted">Values are encrypted before storage and synced to the build infrastructure on deploy. You can change them later.</p>
        {!encryptionConfigured && (
          <ConfigNotice title="Encryption key missing" description="ENCRYPTION_KEY is not configured, so environment variables can't be stored. You can skip this step." />
        )}
        {rows.map((row) => (
          <div key={row.id} className="flex gap-2">
            <Input
              value={row.key}
              onChange={(e) => onChange(rows.map((r) => (r.id === row.id ? { ...r, key: e.target.value } : r)))}
              placeholder="KEY"
              className="font-mono text-[13px]"
              aria-label="Key"
            />
            <Input
              value={row.value}
              type="password"
              onChange={(e) => onChange(rows.map((r) => (r.id === row.id ? { ...r, value: e.target.value } : r)))}
              placeholder="Value"
              className="font-mono text-[13px]"
              aria-label="Value"
              autoComplete="off"
            />
            <Button variant="ghost" size="icon" onClick={() => onChange(rows.filter((r) => r.id !== row.id))} aria-label="Remove variable">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" disabled={!encryptionConfigured} onClick={() => onChange([...rows, { id: ++envCounter, key: "", value: "" }])}>
          <Plus className="h-4 w-4" /> Add variable
        </Button>
        {encryptionConfigured && (
          <details className="rounded-lg border border-border p-3">
            <summary className="cursor-pointer text-[13px] text-muted">Paste a .env file</summary>
            <Textarea value={paste} onChange={(e) => setPaste(e.target.value)} className="mt-3 font-mono text-xs" placeholder={"API_URL=https://api.example.com\nSECRET_KEY=..."} />
            <Button
              size="sm"
              variant="secondary"
              className="mt-2"
              onClick={() => {
                const parsed = parseDotEnv(paste).map((p) => ({ id: ++envCounter, ...p }));
                onChange([...rows.filter((r) => r.key.trim()), ...parsed]);
                setPaste("");
              }}
            >
              Import variables
            </Button>
          </details>
        )}
        {invalid && <Alert tone="danger">Keys may only contain letters, numbers and underscores, and cannot start with a number.</Alert>}
        {duplicate && <Alert tone="danger">Each key can only be defined once.</Alert>}
      </div>
      <StepFooter onBack={onBack} onNext={onNext} nextDisabled={invalid || duplicate} nextLabel={keys.length === 0 ? "Skip" : "Continue"} />
    </Card>
  );
}

function ReviewStep({
  repo,
  config,
  envCount,
  vercelConfigured,
  onBack,
  onNext,
}: {
  repo: GithubRepo;
  config: Config;
  envCount: number;
  vercelConfigured: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const preset = getFramework(config.framework);
  const rows: [string, string][] = [
    ["Project Name", config.name],
    ["Repository", repo.fullName],
    ["Branch", config.branch],
    ["Framework", preset.name],
    ["Root Directory", config.rootDirectory || "./"],
    ["Build Command", config.buildCommand || preset.buildCommand || "Default"],
    ["Install Command", config.installCommand || preset.installCommand || "Default"],
    ["Output Directory", config.outputDirectory || preset.outputDirectory || "Default"],
    ["Environment Variables", `${envCount} variable${envCount === 1 ? "" : "s"}`],
  ];
  return (
    <Card>
      <div className="p-5">
        {!vercelConfigured && (
          <ConfigNotice
            className="mb-5"
            title="Deployments are disabled"
            description="Deployment infrastructure is not configured. Configure platform deployment credentials to enable real deployments. Your project will be created, but it won't be deployed."
          />
        )}
        <dl className="divide-y divide-border rounded-lg border border-border">
          {rows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[160px_1fr] gap-4 px-4 py-2.5 text-[13px]">
              <dt className="text-muted">{label}</dt>
              <dd className="truncate font-medium text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-muted-soft">Deployments are orchestrated and executed on high-performance cloud infrastructure.</p>
      </div>
      <StepFooter onBack={onBack} onNext={onNext} nextLabel={vercelConfigured ? "Deploy" : "Create project"} />
    </Card>
  );
}

type DeployState =
  | { phase: "creating" }
  | { phase: "error"; message: string }
  | { phase: "not-deployed"; projectId: string; message: string }
  | { phase: "deploying"; projectId: string; deploymentId: string };

function DeployStep({ repo, config, envRows, onBack }: { repo: GithubRepo; config: Config; envRows: EnvRow[]; onBack: () => void }) {
  const [state, setState] = useState<DeployState>({ phase: "creating" });
  const [status, setStatus] = useState<DeploymentStatus>("queued");
  const [productionUrl, setProductionUrl] = useState<string | null>(null);
  const toast = useToast();
  const started = useRef(false);

  // Creating a project is not idempotent, so guard against Strict Mode's double effect run.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...config,
            repoOwner: repo.owner,
            repoName: repo.name,
            envVars: envRows.filter((r) => r.key.trim()).map((r) => ({ key: r.key.trim(), value: r.value })),
            deploy: true,
          }),
        });
        const data = (await res.json()) as {
          project?: { id: string };
          deployment?: { id: string };
          deployError?: string;
          error?: string;
        };
        if (!res.ok || !data.project) throw new Error(data.error ?? "Could not create project");
        if (data.deployment) {
          setState({ phase: "deploying", projectId: data.project.id, deploymentId: data.deployment.id });
        } else {
          setState({ phase: "not-deployed", projectId: data.project.id, message: data.deployError ?? "Deployment was not started." });
        }
      } catch (e) {
        setState({ phase: "error", message: e instanceof Error ? e.message : "Something went wrong" });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when this step mounts
  }, []);

  useEffect(() => {
    if (state.phase !== "deploying" || status !== "ready") return;
    fetch(`/api/deployments/${state.deploymentId}`)
      .then((r) => r.json())
      .then((d: { productionUrl?: string | null; deployment?: { url: string | null } }) => {
        setProductionUrl(d.productionUrl ?? d.deployment?.url ?? null);
        toast.success("Deployment successful", "Your project is live.");
      })
      .catch(() => undefined);
  }, [status, state, toast]);

  if (state.phase === "creating") {
    return (
      <Card className="p-10 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground" />
        <p className="mt-4 text-sm text-muted">Creating your project…</p>
      </Card>
    );
  }

  if (state.phase === "error") {
    return (
      <Card>
        <ErrorState title="Project could not be created" description={state.message} action={<Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Back</Button>} />
      </Card>
    );
  }

  if (state.phase === "not-deployed") {
    return (
      <Card className="p-8">
        <div className="flex items-start gap-3">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <h2 className="text-base font-semibold text-foreground">Project created — not deployed</h2>
            <p className="mt-1 text-sm text-muted">{state.message}</p>
            <div className="mt-5 flex gap-2">
              <ButtonLink href={`/dashboard/projects/${state.projectId}`}>View Project</ButtonLink>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {status === "ready" ? (
        <Card className="p-8">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-success" />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-foreground">Deployment Successful</h2>
              <p className="mt-1 text-sm text-muted">Your project is live.</p>
              {productionUrl && (
                <div className="mt-4">
                  <p className="text-xs text-muted">Production URL:</p>
                  <a href={productionUrl} target="_blank" rel="noopener noreferrer" className="mt-0.5 block truncate font-mono text-sm text-accent hover:underline">
                    {productionUrl}
                  </a>
                </div>
              )}
              <div className="mt-6 flex flex-wrap gap-2">
                {productionUrl && (
                  <ButtonLink href={productionUrl} external>
                    Visit Site <ExternalLink className="h-4 w-4" />
                  </ButtonLink>
                )}
                <ButtonLink href={`/dashboard/projects/${state.projectId}`} variant="outline">
                  View Project
                </ButtonLink>
              </div>
            </div>
          </div>
        </Card>
      ) : status === "error" || status === "cancelled" ? (
        <Alert tone="danger">
          The deployment {status === "error" ? "failed" : "was cancelled"}. Review the logs below, adjust your settings and redeploy from the{" "}
          <Link href={`/dashboard/projects/${state.projectId}`} className="font-medium underline">
            project page
          </Link>
          .
        </Alert>
      ) : (
        <Card className="flex items-center gap-3 p-4">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground" />
          <p className="text-sm text-foreground">{status === "queued" ? "Preparing deployment…" : "Building your project…"}</p>
          <Link href={`/dashboard/deployments/${state.deploymentId}`} className="ml-auto text-xs text-muted hover:text-foreground">
            Open deployment
          </Link>
        </Card>
      )}
      <LogViewer deploymentId={state.deploymentId} initialStatus="queued" onStatusChange={setStatus} />
    </div>
  );
}

function StepFooter({
  onBack,
  onNext,
  nextDisabled,
  nextLabel = "Continue",
}: {
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-b-xl border-t border-border bg-background-subtle px-5 py-3">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <Button onClick={onNext} disabled={nextDisabled}>
        {nextLabel} <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
