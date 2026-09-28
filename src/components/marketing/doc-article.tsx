import Link from "next/link";
import { ArrowLeft, ArrowRight, Info } from "lucide-react";
import { DOCS, type DocPage } from "@/lib/content/docs";

export function DocArticle({ doc }: { doc: DocPage }) {
  const index = DOCS.findIndex((d) => d.slug === doc.slug);
  const prev = DOCS[index - 1];
  const next = DOCS[index + 1];

  return (
    <article className="max-w-3xl">
      <p className="font-mono text-xs tracking-wider text-accent uppercase">{doc.group}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{doc.title}</h1>
      <p className="mt-2 text-base text-muted">{doc.description}</p>
      <div className="mt-10 space-y-5">
        {doc.blocks.map((block, i) => {
          switch (block.type) {
            case "h":
              return (
                <h2 key={i} className="pt-4 text-lg font-semibold text-foreground">
                  {block.text}
                </h2>
              );
            case "p":
              return (
                <p key={i} className="text-[15px] leading-relaxed text-muted">
                  {block.text}
                </p>
              );
            case "list":
              return (
                <ul key={i} className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-muted">
                  {block.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              );
            case "code":
              return (
                <pre key={i} className="scrollbar-thin overflow-x-auto rounded-lg border border-border bg-terminal p-4 font-mono text-[13px] leading-6 text-terminal-foreground">
                  {block.text}
                </pre>
              );
            case "note":
              return (
                <div key={i} className="flex gap-3 rounded-lg border border-info/25 bg-info-soft p-4 text-sm text-foreground">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
                  {block.text}
                </div>
              );
          }
        })}
      </div>
      <div className="mt-16 grid gap-3 border-t border-border pt-6 sm:grid-cols-2">
        {prev ? (
          <Link href={`/docs/${prev.slug}`} className="group rounded-lg border border-border p-4 transition-colors hover:border-border-strong">
            <span className="flex items-center gap-1 text-xs text-muted">
              <ArrowLeft className="h-3 w-3" /> Previous
            </span>
            <span className="mt-1 block text-sm font-medium text-foreground">{prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={`/docs/${next.slug}`} className="group rounded-lg border border-border p-4 text-right transition-colors hover:border-border-strong">
            <span className="flex items-center justify-end gap-1 text-xs text-muted">
              Next <ArrowRight className="h-3 w-3" />
            </span>
            <span className="mt-1 block text-sm font-medium text-foreground">{next.title}</span>
          </Link>
        )}
      </div>
    </article>
  );
}
