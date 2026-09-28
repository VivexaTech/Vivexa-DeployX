import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocArticle } from "@/components/marketing/doc-article";
import { DOCS, getDoc } from "@/lib/content/docs";

export function generateStaticParams() {
  return DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) return {};
  return { title: `${doc.title} · Docs`, description: doc.description, alternates: { canonical: `/docs/${doc.slug}` } };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();
  return <DocArticle doc={doc} />;
}
