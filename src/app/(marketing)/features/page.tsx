import type { Metadata } from "next";
import { CtaSection, DashboardPreview, FeaturesGrid, HowItWorks, SectionHeading, WorkflowDiagram } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Features",
  description: "GitHub integration, one-click deployments, custom domains, deployment logs and secure environment variables.",
  alternates: { canonical: "/features" },
};

export default function FeaturesPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-5 pt-20 pb-16">
        <SectionHeading
          eyebrow="Features"
          title="Built for teams that ship"
          description="DeployX brings repositories, builds, domains and monitoring into one clean workflow."
        />
        <div className="mt-14">
          <FeaturesGrid />
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-16">
        <SectionHeading eyebrow="Workflow" title="How a deployment flows" />
        <div className="mt-12">
          <WorkflowDiagram />
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-16">
        <SectionHeading eyebrow="Steps" title="Six steps to production" />
        <div className="mt-12">
          <HowItWorks />
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-16">
        <DashboardPreview />
      </section>
      <section className="mx-auto max-w-6xl px-5 py-16 pb-24">
        <CtaSection />
      </section>
    </>
  );
}
