import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { HeroTerminal } from "@/components/marketing/hero-terminal";
import {
  CtaSection,
  DashboardPreview,
  FaqList,
  FeaturesGrid,
  HowItWorks,
  PricingSection,
  SectionHeading,
  WorkflowDiagram,
} from "@/components/marketing/sections";
import { siteConfig } from "@/lib/site";

const TECH = ["Next.js", "React", "Vite", "Vue", "Nuxt", "Astro", "Static HTML"];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: siteConfig.name,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  url: siteConfig.url,
  description: siteConfig.description,
  publisher: { "@type": "Organization", name: siteConfig.company },
};

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <section className="relative overflow-hidden">
        <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />
        <div
          className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full opacity-[0.12] blur-3xl"
          style={{ background: "radial-gradient(closest-side, var(--accent), transparent)" }}
          aria-hidden
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pt-20 pb-24 lg:grid-cols-[1.1fr_1fr] lg:pt-28">
          <div className="animate-slide-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              {siteConfig.tagline}
            </span>
            <h1 className="text-gradient mt-6 text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl lg:text-[3.4rem]">
              Deploy your projects without the complexity.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              Connect GitHub, deploy your applications, manage domains, and monitor deployments from one powerful dashboard.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="/auth/register" size="lg">
                Start Deploying <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink href="/features" variant="outline" size="lg">
                Explore Features
              </ButtonLink>
            </div>
            <p className="mt-6 text-xs text-muted-soft">Powered by {siteConfig.company}</p>
          </div>
          <div className="animate-slide-up [animation-delay:120ms]">
            <HeroTerminal />
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-background-subtle">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 py-6">
          <span className="text-xs text-muted-soft">Deploy apps built with</span>
          {TECH.map((t) => (
            <span key={t} className="font-mono text-[13px] text-muted">
              {t}
            </span>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-24" id="features">
        <SectionHeading
          eyebrow="Features"
          title="Everything you need to ship"
          description="A focused toolset for taking code from GitHub to production and keeping it healthy."
        />
        <div className="mt-14">
          <FeaturesGrid />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-24">
        <SectionHeading eyebrow="How it works" title="From repository to live in six steps" />
        <div className="mt-14">
          <HowItWorks />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-24">
        <SectionHeading
          eyebrow="Deployment workflow"
          title="Transparent by design"
          description="DeployX orchestrates your deployments and keeps status and logs in sync — with the infrastructure provider clearly disclosed."
        />
        <div className="mt-14">
          <WorkflowDiagram />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-24">
        <SectionHeading eyebrow="Dashboard" title="One place for every project" description="Status, branches, commits and domains — organized and searchable." />
        <div className="mt-14">
          <DashboardPreview />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-24" id="pricing">
        <SectionHeading eyebrow="Pricing" title="Simple, transparent pricing" description="Start free. Upgrade when you need more." />
        <div className="mt-14">
          <PricingSection />
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-24">
        <SectionHeading eyebrow="FAQ" title="Frequently asked questions" />
        <div className="mt-12">
          <FaqList limit={6} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24">
        <CtaSection />
      </section>
    </>
  );
}
