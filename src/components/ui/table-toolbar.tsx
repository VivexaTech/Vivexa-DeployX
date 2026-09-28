"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function useUpdateParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "" || value === "all") next.delete(key);
      else next.set(key, value);
    }
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next.toString()}` : ""}`, { scroll: false }));
  };
  return { params, update, pending };
}

/** URL-driven search + filter bar for server-rendered tables. */
export function TableToolbar({
  placeholder = "Search…",
  filters,
  filterParam = "status",
}: {
  placeholder?: string;
  filters?: { value: string; label: string }[];
  filterParam?: string;
}) {
  const { params, update, pending } = useUpdateParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const activeFilter = params.get(filterParam) ?? "all";

  useEffect(() => {
    const current = params.get("q") ?? "";
    if (query === current) return;
    const id = setTimeout(() => update({ q: query, page: null }), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on query only
  }, [query]);

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border p-3">
      <div className="relative w-full max-w-xs">
        {pending ? (
          <Loader2 className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 animate-spin text-muted-soft" />
        ) : (
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-soft" />
        )}
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} className="pl-9" aria-label="Search" />
      </div>
      {filters && (
        <div className="flex flex-wrap gap-1">
          {[{ value: "all", label: "All" }, ...filters].map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => update({ [filterParam]: f.value, page: null })}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                activeFilter === f.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Pagination({ page, pageSize, total }: { page: number; pageSize: number; total: number }) {
  const { update } = useUpdateParams();
  if (total <= pageSize) return null;
  const pageCount = Math.ceil(total / pageSize);
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted">
      <span>
        {page * pageSize + 1}–{Math.min(total, (page + 1) * pageSize)} of {total}
      </span>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => update({ page: String(page - 1) })} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pageCount - 1}
          onClick={() => update({ page: String(page + 1) })}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
