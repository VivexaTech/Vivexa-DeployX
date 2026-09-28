import type { Metadata } from "next";
import { DocArticle } from "@/components/marketing/doc-article";
import { DOCS } from "@/lib/content/docs";

export const metadata: Metadata = {
  title: "Documentation",
  description: "Learn how to deploy, manage domains and configure projects on Vivexa DeployX.",
  alternates: { canonical: "/docs" },
};

export default function DocsIndexPage() {
  return <DocArticle doc={DOCS[0]} />;
}
