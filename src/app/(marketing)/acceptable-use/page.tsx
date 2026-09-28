import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Acceptable Use Policy",
  description: "What you may and may not deploy with Vivexa DeployX.",
  alternates: { canonical: "/acceptable-use" },
};

export default function Page() {
  return <LegalPage docKey="acceptable_use" />;
}