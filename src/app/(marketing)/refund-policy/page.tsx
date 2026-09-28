import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "Refund policy for paid Vivexa DeployX plans.",
  alternates: { canonical: "/refund-policy" },
};

export default function Page() {
  return <LegalPage docKey="refund" />;
}