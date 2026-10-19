import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Infrastructure Disclosure",
  description: "How Vivexa DeployX provides enterprise cloud hosting and automated build infrastructure.",
  alternates: { canonical: "/infrastructure" },
};

export default function Page() {
  return <LegalPage docKey="infrastructure" />;
}