"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function DocsNav({ groups }: { groups: { name: string; items: { slug: string; title: string }[] }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Documentation" className="space-y-6">
      {groups.map((group) => (
        <div key={group.name}>
          <p className="mb-2 px-2 text-[11px] font-medium tracking-wider text-muted-soft uppercase">{group.name}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const href = `/docs/${item.slug}`;
              const active = pathname === href || (pathname === "/docs" && item.slug === "introduction");
              return (
                <li key={item.slug}>
                  <Link
                    href={href}
                    className={cn(
                      "block rounded-md px-2 py-1.5 text-[13px] transition-colors",
                      active ? "bg-background-subtle font-medium text-foreground" : "text-muted hover:text-foreground",
                    )}
                  >
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
