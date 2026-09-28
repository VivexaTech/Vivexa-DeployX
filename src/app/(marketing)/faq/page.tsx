import type { Metadata } from "next";
import { FaqList, SectionHeading } from "@/components/marketing/sections";
import { FAQS } from "@/lib/content/faq";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers to common questions about Vivexa DeployX.",
  alternates: { canonical: "/faq" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
};

export default function FaqPage() {
  return (
    <section className="mx-auto max-w-3xl px-5 pt-20 pb-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <SectionHeading eyebrow="FAQ" title="Frequently asked questions" />
      <div className="mt-12">
        <FaqList />
      </div>
    </section>
  );
}
