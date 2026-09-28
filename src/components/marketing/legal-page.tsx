import Link from "next/link";
import { LegalContent } from "@/components/marketing/legal-content";
import { getPlatformSettings, type PlatformSettings } from "@/lib/data/settings";
import { LEGAL_DEFAULTS, LEGAL_META, type LegalKey } from "@/lib/content/legal";
import { cn } from "@/lib/utils";

export async function LegalPage({ docKey }: { docKey: LegalKey }) {
  const settings = await getPlatformSettings();
  const meta = LEGAL_META[docKey];
  const override = settings[meta.settingKey as keyof PlatformSettings];
  const source = typeof override === "string" && override.trim() ? override : LEGAL_DEFAULTS[docKey];

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-5 pt-16 pb-24 md:grid-cols-[220px_1fr]">
      <aside className="md:sticky md:top-24 md:h-fit">
        <p className="mb-2 px-2 text-[11px] font-medium tracking-wider text-muted-soft uppercase">Legal</p>
        <ul className="space-y-0.5">
          {(Object.keys(LEGAL_META) as LegalKey[]).map((key) => (
            <li key={key}>
              <Link
                href={LEGAL_META[key].path}
                className={cn(
                  "block rounded-md px-2 py-1.5 text-[13px] transition-colors",
                  key === docKey ? "bg-background-subtle font-medium text-foreground" : "text-muted hover:text-foreground",
                )}
              >
                {LEGAL_META[key].title}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
      <article className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{meta.title}</h1>
        <p className="mt-2 text-sm text-muted-soft">Last updated: [DATE]</p>
        <div className="mt-8">
          <LegalContent source={source} />
        </div>
      </article>
    </div>
  );
}
