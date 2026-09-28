import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "Terms and conditions for using Vivexa DeployX.",
  alternates: { canonical: "/terms" },
};

export default function Page() {
  return <LegalPage docKey="terms" />;
}