import type { Metadata } from "next";
import { FaqList, PricingSection, SectionHeading } from "@/components/marketing/sections";
import { getPlatformSettings } from "@/lib/data/settings";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, transparent pricing for Vivexa DeployX. Start free and upgrade as you grow.",
  alternates: { canonical: "/pricing" },
};

export default async function PricingPage() {
  const settings = await getPlatformSettings();
  return (
    <>
      <section className="mx-auto max-w-6xl px-5 pt-20 pb-16">
        <SectionHeading
          eyebrow="Pricing"
          title="Plans that scale with you"
          description="Prepaid monthly or yearly plans, billed in INR through Razorpay. No auto-renewal surprises."
        />
        <div className="mt-14">
          {settings.pricing_visible ? (
            <PricingSection />
          ) : (
            <p className="text-center text-sm text-muted">Pricing is currently unavailable. Please contact {settings.support_email}.</p>
          )}
        </div>
        <p className="mt-8 text-center text-xs text-muted-soft">
          Prices are inclusive of applicable taxes unless stated otherwise. [TAX TREATMENT TO BE CONFIRMED]
        </p>
      </section>
      <section className="mx-auto max-w-3xl px-5 py-16 pb-24">
        <SectionHeading title="Questions about billing?" />
        <div className="mt-10">
          <FaqList />
        </div>
      </section>
    </>
  );
}
