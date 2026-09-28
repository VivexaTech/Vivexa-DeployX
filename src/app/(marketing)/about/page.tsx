import type { Metadata } from "next";
import { CtaSection, SectionHeading } from "@/components/marketing/sections";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: "Vivexa DeployX is built and operated by Vivexa Tech.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <section className="mx-auto max-w-3xl px-5 pt-20 pb-12">
        <SectionHeading eyebrow="About" title="Deployment, without the complexity" center={false} />
        <div className="mt-8 space-y-5 text-[15px] leading-relaxed text-muted">
          <p>
            {siteConfig.name} is a deployment management platform built and operated by {siteConfig.company}. We believe shipping
            software should be simple: connect your repository, configure once, and deploy with confidence.
          </p>
          <p>
            DeployX brings GitHub integration, deployments, logs, environment variables and domains into one focused dashboard, with
            billing designed for developers and teams in India.
          </p>
          <p>{siteConfig.infrastructureDisclosure}</p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-16 pb-24">
        <CtaSection />
      </section>
    </>
  );
}
