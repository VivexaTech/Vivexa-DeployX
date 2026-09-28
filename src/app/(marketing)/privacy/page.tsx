import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Vivexa DeployX collects and uses information.",
  alternates: { canonical: "/privacy" },
};

export default function Page() {
  return <LegalPage docKey="privacy" />;
}