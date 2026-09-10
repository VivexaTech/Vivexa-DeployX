import Link from "next/link";
import { ArrowRight, Check, GitBranch, Globe, Shield, Zap } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import {
  AboutSection,
  PricingSection,
  ProjectsSection,
  SupportSection,
} from "@/components/marketing/dynamic-sections";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const features = [
  ["GitHub deployment", "Connect repositories and ship from the branches you choose."],
  ["One-click deployment", "Create a project, check your plan, and deploy in one flow."],
  ["Deployment management", "Redeploy, inspect status, and keep a full history."],
  ["Project dashboard", "See usage, plan limits, and live project health."],
  ["Deployment history", "Commit, branch, URL, and status for every release."],
  ["Custom domains", "Connect any registrar with live DNS instructions from Vercel."],
  ["Environment variables", "Store project secrets on the server, never in the browser."],
  ["Automatic deployment", "Optional push-to-deploy when your plan includes it."],
  ["Subscription plans", "Firestore-configured plans with Razorpay subscriptions."],
  ["Billing management", "Upgrade, change, or cancel from the dashboard."],
  ["Invoices", "A PDF invoice is generated after verified payments."],
  ["Email notifications", "Resend sends purchase, failure, and renewal emails."],
  ["Deployment status", "Ready, building, and failed states stay visible."],
  ["Secure authentication", "Google sign-in with server-verified Firebase sessions."],
  ["Light / Dark mode", "Theme preference applies across the whole product."],
];

const steps = [
  ["Create your account", "Sign in with Google and we create your Vivexa DeployX profile."],
  ["Connect GitHub", "Authorize repository access through a server-side OAuth flow."],
  ["Select and configure", "Pick a repo, branch, name, optional env vars, and subdomain."],
  ["Deploy and manage", "We enforce your plan, deploy through Vercel, and keep history."],
];

const reasons = [
  ["Simple deployment", "A single guided flow from GitHub to a live URL."],
  ["Centralized project management", "Projects, domains, invoices, and notifications in one place."],
  ["Developer-friendly workflow", "Repos, branches, env vars, and redeploys without leaving the dashboard."],
  ["Transparent pricing", "What you see on the pricing page comes from your live plan catalog."],
  ["Custom domain support", "Generic DNS instructions that work with any standard registrar."],
  ["Automated billing", "Razorpay webhooks activate plans and generate invoices."],
  ["Email notifications", "Renewal reminders go out even if nobody has the dashboard open."],
  ["Professional infrastructure", "Deployments run on Vercel. The product experience is Vivexa DeployX."],
];

const faqs = [
  ["What is Vivexa DeployX?", "A Vivexa Tech platform for connecting GitHub, deploying websites, managing domains, and handling subscriptions from one dashboard."],
  ["How does deployment work?", "After you select a repository, the server checks your subscription and website quota, creates a Vercel project, and triggers a deployment."],
  ["Can I connect GitHub?", "Yes. GitHub OAuth is handled on the server. Tokens are encrypted and never exposed to the browser."],
  ["Can I use my own domain?", "Yes, if your plan includes custom domains. Enter the hostname and follow the DNS records returned by Vercel."],
  ["What happens when I reach my plan limit?", "New websites are blocked server-side. You will see an upgrade prompt instead of a silent failure."],
  ["How does billing work?", "You choose a Firestore plan, Razorpay creates a subscription, and webhooks are the source of truth for activation."],
  ["When will I receive my invoice?", "After a payment or subscription charge is verified by webhook, an invoice is stored and emailed."],
  ["What happens if payment fails?", "We mark the subscription past due, email you, and keep existing projects unless you later choose a stricter policy."],
  ["How do I upgrade my plan?", "Open Billing or Pricing, choose another plan, and complete Razorpay checkout or an in-place plan change."],
];

export default function HomePage() {
  return (
    <div>
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden px-4 pt-16 pb-20">
          <div className="surface-grid pointer-events-none absolute inset-0" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="inline-flex rounded-full border border-line bg-bg-elevated px-3 py-1 text-xs font-semibold text-muted">
                Built by Vivexa Tech
              </p>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">
                Deploy your websites with simplicity.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-muted">
                Connect GitHub, choose a repository, and deploy through Vivexa DeployX. Hosting runs on Vercel
                infrastructure. The dashboard, billing, domains, invoices, and support stay yours.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/signup">
                  <Button size="lg">
                    Get Started <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="secondary">
                    Login
                  </Button>
                </Link>
              </div>
              <p className="mt-6 text-sm text-muted">
                Plan limits are enforced on the server. No fake uptime claims. No client-only security.
              </p>
            </div>
            <Card className="p-5">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>deployx.vivexatech.in</span>
                <span className="rounded-full bg-accent-soft px-2 py-1 text-success">Ready</span>
              </div>
              <div className="mt-4 rounded-xl bg-bg p-4">
                <p className="text-sm font-medium">studio-site</p>
                <p className="mt-1 font-mono text-xs text-muted">github.com/you/studio-site · main</p>
                <div className="mt-4 h-2 rounded-full bg-accent-soft">
                  <div className="h-2 w-2/3 rounded-full bg-accent" />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg border border-line p-3">
                    <Globe className="h-4 w-4 text-accent" />
                    <p className="mt-2 font-medium">Domain</p>
                  </div>
                  <div className="rounded-lg border border-line p-3">
                    <GitBranch className="h-4 w-4 text-accent" />
                    <p className="mt-2 font-medium">GitHub</p>
                  </div>
                  <div className="rounded-lg border border-line p-3">
                    <Shield className="h-4 w-4 text-accent" />
                    <p className="mt-2 font-medium">Plan check</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>

        <section id="product" className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-accent">What is Vivexa DeployX</p>
              <h2 className="mt-2 text-3xl font-semibold">A branded deployment workspace for GitHub sites</h2>
            </div>
            <p className="text-muted">
              Vivexa DeployX is a deployment platform created by Vivexa Tech. Users connect GitHub repositories,
              deploy websites, manage projects, configure domains, and monitor deployments from one dashboard.
              Vercel is the underlying deployment infrastructure. Vivexa DeployX does not claim to own that
              infrastructure — it owns the product experience around it.
            </p>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-3xl font-semibold">Everything required to run a deployment product</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(([title, copy]) => (
              <Card key={title} className="p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <Check className="h-4 w-4" />
                </div>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted">{copy}</p>
              </Card>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-3xl font-semibold">How it works</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {steps.map(([title, copy], index) => (
              <div key={title} className="relative">
                <Card className="h-full p-5">
                  <p className="text-xs font-semibold text-accent">Step {index + 1}</p>
                  <h3 className="mt-2 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-muted">{copy}</p>
                </Card>
                {index < steps.length - 1 ? (
                  <div className="absolute top-1/2 -right-2 hidden h-px w-4 bg-line md:block" />
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section id="workflow" className="mx-auto max-w-6xl px-4 py-16">
          <Card className="p-6 md:p-8">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-accent" />
              <h2 className="text-2xl font-semibold">Deployment workflow</h2>
            </div>
            <ol className="mt-6 grid gap-3 text-sm text-muted md:grid-cols-2">
              <li>1. Authenticate the user</li>
              <li>2. Confirm an eligible subscription</li>
              <li>3. Check website quota in a Firestore transaction</li>
              <li>4. Create or reuse the Vercel project</li>
              <li>5. Trigger the GitHub-backed deployment</li>
              <li>6. Store metadata, notify, and show the live URL</li>
            </ol>
          </Card>
        </section>

        <section id="why" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-3xl font-semibold">Why choose Vivexa DeployX</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {reasons.map(([title, copy]) => (
              <Card key={title} className="p-5">
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted">{copy}</p>
              </Card>
            ))}
          </div>
        </section>

        <PricingSection />
        <ProjectsSection />
        <AboutSection />
        <SupportSection />

        <section id="faq" className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-3xl font-semibold">FAQ</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {faqs.map(([q, a]) => (
              <Card key={q} className="p-5">
                <h3 className="font-semibold">{q}</h3>
                <p className="mt-2 text-sm text-muted">{a}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20">
          <Card className="flex flex-col items-start justify-between gap-4 bg-accent p-8 text-white dark:text-ink md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-semibold">Ready to deploy with Vivexa DeployX?</h2>
              <p className="mt-2 text-sm opacity-80">Create an account, connect GitHub, and ship your first site.</p>
            </div>
            <Link href="/signup">
              <Button variant="highlight">Get Started</Button>
            </Link>
          </Card>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
