import {
  Activity,
  ArrowRight,
  Boxes,
  ChevronDown,
  GitBranch,
  Globe,
  KeyRound,
  LayoutDashboard,
  Rocket,
  ScrollText,
  ShieldCheck,
  Server,
  Database,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { GithubIcon as Github } from "@/components/ui/icons";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfigNotice } from "@/components/ui/states";
import { PricingTable } from "@/components/marketing/pricing-table";
import { getActivePlans } from "@/lib/data/plans";
import { FAQS } from "@/lib/content/faq";
import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  center = true,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  center?: boolean;
}) {
  return (
    <div className={cn("max-w-2xl", center && "mx-auto text-center")}>
      {eyebrow && <p className="font-mono text-xs tracking-wider text-accent uppercase">{eyebrow}</p>}
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h2>
      {description && <p className="mt-4 text-base leading-relaxed text-muted">{description}</p>}
    </div>
  );
}

export const FEATURES = [
  { icon: Github, title: "GitHub Integration", description: "Connect GitHub and import repositories in a couple of clicks." },
  { icon: Rocket, title: "One-Click Deployment", description: "Deploy projects with a simple, guided workflow and sensible defaults." },
  { icon: Activity, title: "Deployment Management", description: "View status, deployment history and project details at a glance." },
  { icon: Globe, title: "Custom Domains", description: "Connect custom domains and free DeployX subdomains with guided DNS." },
  { icon: ShieldCheck, title: "Secure Infrastructure", description: "Secure authentication, encrypted secrets and server-side integrations." },
  { icon: LayoutDashboard, title: "Developer Dashboard", description: "Manage every project from one centralized, keyboard-friendly dashboard." },
  { icon: ScrollText, title: "Deployment Logs", description: "Follow build output live with a terminal-style log viewer." },
  { icon: KeyRound, title: "Environment Variables", description: "Manage project environment variables securely, encrypted at rest." },
];

export function FeaturesGrid() {
  return (
    <div className="grid overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 1 }}>
      {FEATURES.map(({ icon: Icon, title, description }) => (
        <div key={title} className="group bg-card p-6 transition-colors hover:bg-card-hover">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background-subtle text-foreground transition-colors group-hover:border-accent/40 group-hover:text-accent">
            <Icon className="h-4 w-4" />
          </div>
          <h3 className="mt-5 text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{description}</p>
        </div>
      ))}
    </div>
  );
}

const STEPS = [
  { title: "Connect GitHub", description: "Authorize DeployX to read your repositories." },
  { title: "Select Repository", description: "Search and pick the repository and branch." },
  { title: "Configure Project", description: "Framework, build commands and root directory." },
  { title: "Deploy", description: "We fetch, upload and build your project." },
  { title: "Connect Domain", description: "Add a DeployX subdomain or your own domain." },
  { title: "Go Live", description: "Your project is live and monitored." },
];

export function HowItWorks() {
  return (
    <ol className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
      {STEPS.map((step, i) => (
        <li key={step.title} className="bg-card p-6">
          <span className="font-mono text-xs text-muted-soft">{String(i + 1).padStart(2, "0")}</span>
          <h3 className="mt-3 text-sm font-semibold text-foreground">{step.title}</h3>
          <p className="mt-1 text-[13px] text-muted">{step.description}</p>
        </li>
      ))}
    </ol>
  );
}

const FLOW = [
  { icon: LayoutDashboard, label: "DeployX Dashboard" },
  { icon: Github, label: "GitHub Repository" },
  { icon: Boxes, label: "DeployX Orchestrator" },
  { icon: Server, label: "Cloud Build Engine" },
  { icon: Database, label: "Status & Logs Synced" },
];

export function WorkflowDiagram() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
      <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
        {FLOW.map(({ icon: Icon, label }, i) => (
          <div key={label} className="flex flex-1 flex-col items-center gap-3 lg:flex-row">
            <div className="flex w-full flex-1 items-center gap-3 rounded-lg border border-border bg-background-subtle px-4 py-3">
              <Icon className="h-4 w-4 shrink-0 text-accent" />
              <span className="text-[13px] font-medium text-foreground">{label}</span>
            </div>
            {i < FLOW.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 rotate-90 text-muted-soft lg:rotate-0" />}
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-muted-soft">
        Deployments are orchestrated and executed on high-performance cloud infrastructure.
      </p>
    </div>
  );
}

const PREVIEW_ROWS = [
  { name: "storefront", status: "ready", branch: "main", commit: "a1c9e02", time: "2m ago" },
  { name: "marketing-site", status: "building", branch: "main", commit: "7fd21b4", time: "just now" },
  { name: "docs", status: "ready", branch: "release", commit: "03be8c1", time: "1h ago" },
  { name: "api-playground", status: "error", branch: "feat/auth", commit: "c44d9a0", time: "3h ago" },
];

export function DashboardPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card" aria-label="Illustrative dashboard preview">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2 text-[13px]">
          <span className="font-medium text-foreground">Overview</span>
          <span className="text-muted-soft">/</span>
          <span className="text-muted">Recent deployments</span>
        </div>
        <span className="rounded-md border border-border px-2 py-0.5 font-mono text-[10px] text-muted-soft">Preview</span>
      </div>
      <div className="grid grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-4">
        {[
          ["Projects", "4"],
          ["Active deployments", "1"],
          ["Domains", "3"],
          ["Current plan", "Starter"],
        ].map(([label, value]) => (
          <div key={label} className="bg-card px-5 py-4">
            <p className="text-[11px] text-muted">{label}</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
          </div>
        ))}
      </div>
      <div className="divide-y divide-border">
        {PREVIEW_ROWS.map((row) => (
          <div key={row.name} className="grid grid-cols-[1.5fr_1fr_auto] items-center gap-4 px-5 py-3 text-[13px] sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
            <span className="font-medium text-foreground">{row.name}</span>
            <StatusBadge status={row.status} />
            <span className="hidden items-center gap-1.5 text-muted sm:flex">
              <GitBranch className="h-3.5 w-3.5" />
              {row.branch}
            </span>
            <span className="hidden font-mono text-muted sm:block">{row.commit}</span>
            <span className="text-right text-muted-soft">{row.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FaqList({ limit }: { limit?: number }) {
  const items = limit ? FAQS.slice(0, limit) : FAQS;
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card">
      {items.map((item) => (
        <details key={item.q} className="group px-5 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-medium text-foreground">
            {item.q}
            <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
          </summary>
          <p className="pb-5 text-[13px] leading-relaxed text-muted">{item.a}</p>
        </details>
      ))}
    </div>
  );
}

export async function PricingSection() {
  const { plans, configured, error } = await getActivePlans();
  if (!configured) {
    return (
      <ConfigNotice
        title="Pricing is loaded from the database"
        description="Supabase is not configured, so plans can't be displayed. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY, then run the migrations and seed."
      />
    );
  }
  if (error) return <p className="text-center text-sm text-muted">{error}</p>;
  if (plans.length === 0) return <p className="text-center text-sm text-muted">No plans are available right now.</p>;
  return <PricingTable plans={plans} />;
}

export function CtaSection() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-16 text-center">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden />
      <div className="relative">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Ship your next project today.</h2>
        <p className="mx-auto mt-4 max-w-lg text-muted">Connect GitHub and go from repository to production URL in minutes.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/auth/register" size="lg">
            Start Deploying <ArrowRight className="h-4 w-4" />
          </ButtonLink>
          <ButtonLink href="/pricing" variant="outline" size="lg">
            View pricing
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
