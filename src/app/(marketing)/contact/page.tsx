import type { Metadata } from "next";
import { LifeBuoy, Mail, ShieldAlert } from "lucide-react";
import { SectionHeading } from "@/components/marketing/sections";
import { ButtonLink } from "@/components/ui/button";
import { getPlatformSettings } from "@/lib/data/settings";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the Vivexa DeployX team.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const settings = await getPlatformSettings();
  const cards = [
    {
      icon: Mail,
      title: "General & sales",
      description: "Questions about plans, enterprise needs or partnerships.",
      action: (
        <a href={`mailto:${settings.support_email}`} className="text-sm font-medium text-accent hover:underline">
          {settings.support_email}
        </a>
      ),
    },
    {
      icon: LifeBuoy,
      title: "Customer support",
      description: "Existing customers get the fastest help through support tickets.",
      action: (
        <ButtonLink href="/dashboard/support" variant="outline" size="sm">
          Open a ticket
        </ButtonLink>
      ),
    },
    {
      icon: ShieldAlert,
      title: "Abuse reports",
      description: "Report malware, phishing or policy violations hosted via DeployX.",
      action: (
        <a href={`mailto:${settings.support_email}?subject=Abuse%20report`} className="text-sm font-medium text-accent hover:underline">
          Report abuse
        </a>
      ),
    },
  ];

  return (
    <section className="mx-auto max-w-5xl px-5 pt-20 pb-24">
      <SectionHeading eyebrow="Contact" title="We're here to help" description="Reach the Vivexa Tech team through the channel that fits best." />
      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {cards.map(({ icon: Icon, title, description, action }) => (
          <div key={title} className="flex flex-col rounded-xl border border-border bg-card p-6">
            <Icon className="h-5 w-5 text-accent" />
            <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
            <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-muted">{description}</p>
            <div className="mt-5">{action}</div>
          </div>
        ))}
      </div>
      <p className="mt-10 text-center text-xs text-muted-soft">[REGISTERED OFFICE ADDRESS — to be added]</p>
    </section>
  );
}
