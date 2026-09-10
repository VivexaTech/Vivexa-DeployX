"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicContent } from "@/hooks/use-public-content";
import { formatCurrency } from "@/lib/utils";

export function PricingSection() {
  const { plans, loading } = usePublicContent();
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-20">
      <p className="text-sm font-semibold text-accent">Pricing</p>
      <h2 className="mt-2 text-3xl font-semibold">Plans that follow your website limit</h2>
      <p className="mt-3 max-w-2xl text-muted">
        Plans are loaded from Firestore. Website limits, features, and Razorpay plan IDs are configured by the
        platform owner — not hardcoded.
      </p>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {loading
          ? [0, 1, 2].map((item) => <Skeleton key={item} className="h-80" />)
          : plans.length === 0
            ? (
              <Card className="p-6 md:col-span-3">
                <p className="text-sm text-muted">
                  No active plans are published yet. Add documents under <code>about/pricing/plans</code> in
                  Firestore.
                </p>
              </Card>
            )
            : plans.map((plan) => (
                <Card key={plan.id} className="flex flex-col p-6">
                  <p className="text-sm text-muted">{plan.duration}</p>
                  <h3 className="mt-1 text-2xl font-semibold">{plan.planName}</h3>
                  <p className="mt-3 text-3xl font-semibold">{formatCurrency(plan.planPrice, plan.currency)}</p>
                  <p className="mt-2 text-sm text-muted">{plan.maxWebsites} websites included</p>
                  <ul className="mt-5 flex-1 space-y-2 text-sm text-muted">
                    {plan.keyPoints.map((point) => (
                      <li key={point}>• {point}</li>
                    ))}
                  </ul>
                  <Link href={`/signup?plan=${plan.id}`} className="mt-6">
                    <Button className="w-full">Choose {plan.planName}</Button>
                  </Link>
                </Card>
              ))}
      </div>
    </section>
  );
}

export function ProjectsSection() {
  const { projects, loading } = usePublicContent();
  return (
    <section id="projects" className="mx-auto max-w-6xl px-4 py-20">
      <p className="text-sm font-semibold text-accent">Showcase</p>
      <h2 className="mt-2 text-3xl font-semibold">Projects launched with Vivexa DeployX</h2>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {loading
          ? [0, 1, 2].map((item) => <Skeleton key={item} className="h-72" />)
          : projects.length === 0
            ? (
              <Card className="p-6 md:col-span-3">
                <p className="text-sm text-muted">
                  Showcase projects will appear here once they are added to <code>about/projects</code>.
                </p>
              </Card>
            )
            : projects.map((project) => (
                <Card key={project.id} className="overflow-hidden">
                  {project.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={project.image} alt={project.title} className="h-44 w-full object-cover" />
                  ) : (
                    <div className="h-44 bg-accent-soft" />
                  )}
                  <div className="p-5">
                    <h3 className="font-semibold">{project.title}</h3>
                    <p className="mt-2 text-sm text-muted">{project.description}</p>
                    <a href={project.projectUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex">
                      <Button size="sm">Visit Project</Button>
                    </a>
                  </div>
                </Card>
              ))}
      </div>
    </section>
  );
}

export function AboutSection() {
  const { company } = usePublicContent();
  return (
    <section id="about" className="mx-auto max-w-6xl px-4 py-20">
      <p className="text-sm font-semibold text-accent">About</p>
      <h2 className="mt-2 text-3xl font-semibold">Vivexa DeployX and Vivexa Tech</h2>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <Card className="p-6">
          <h3 className="font-semibold">The platform</h3>
          <p className="mt-3 text-sm leading-6 text-muted">
            {company.aboutPlatform ||
              "Vivexa DeployX is a deployment platform created by Vivexa Tech. It lets teams connect GitHub repositories, deploy websites, manage projects, configure domains, and monitor deployments from one branded dashboard. Underlying hosting is provided through Vercel APIs — the user experience remains Vivexa DeployX."}
          </p>
        </Card>
        <Card className="p-6">
          <h3 className="font-semibold">The company</h3>
          <p className="mt-3 text-sm leading-6 text-muted">
            {company.aboutCompany ||
              "Vivexa Tech builds practical software products for businesses and developers. Company details can be updated from Firestore without changing application code."}
          </p>
        </Card>
        <Card className="p-6">
          <h3 className="font-semibold">Mission</h3>
          <p className="mt-3 text-sm leading-6 text-muted">
            {company.mission ||
              "Make website deployment simple, accountable, and commercially clear — with plan limits, invoices, and support that belong to Vivexa DeployX."}
          </p>
        </Card>
        <Card className="p-6">
          <h3 className="font-semibold">Why it exists</h3>
          <p className="mt-3 text-sm leading-6 text-muted">
            {company.whyExists ||
              "Teams needed a branded way to ship sites from GitHub without stitching together billing, domains, emails, and project operations themselves."}
          </p>
        </Card>
      </div>
    </section>
  );
}

export function SupportSection() {
  const { support, loading } = usePublicContent();
  return (
    <section id="support" className="mx-auto max-w-6xl px-4 py-20">
      <p className="text-sm font-semibold text-accent">Support</p>
      <h2 className="mt-2 text-3xl font-semibold">Talk to Vivexa Tech</h2>
      <Card className="mt-8 p-6">
        {loading ? (
          <Skeleton className="h-24" />
        ) : support?.email || support?.phone ? (
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted">Email</p>
              <a className="font-medium" href={`mailto:${support.email}`}>
                {support.email}
              </a>
            </div>
            <div>
              <p className="text-sm text-muted">Phone</p>
              <a className="font-medium" href={`tel:${support.phone}`}>
                {support.phone}
              </a>
            </div>
            <div>
              <p className="text-sm text-muted">Need help in the product?</p>
              <Link href="/dashboard/support">
                <Button className="mt-2">Contact support</Button>
              </Link>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">
            Support phone and email are configured in Firestore at <code>about/support</code>.
          </p>
        )}
      </Card>
    </section>
  );
}
