import { DocsNav } from "@/components/marketing/docs-nav";
import { DOCS } from "@/lib/content/docs";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const groupNames = Array.from(new Set(DOCS.map((d) => d.group)));
  const groups = groupNames.map((name) => ({
    name,
    items: DOCS.filter((d) => d.group === name).map((d) => ({ slug: d.slug, title: d.title })),
  }));
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-5 pt-12 pb-24 md:grid-cols-[220px_1fr]">
      <aside className="md:sticky md:top-24 md:h-fit">
        <DocsNav groups={groups} />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
