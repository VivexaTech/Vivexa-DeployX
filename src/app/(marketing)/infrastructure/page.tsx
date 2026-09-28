import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Infrastructure Disclosure",
  description: "How DeployX uses third-party infrastructure providers, including Vercel.",
  alternates: { canonical: "/infrastructure" },
};

export default function Page() {
  return <LegalPage docKey="infrastructure" />;
}