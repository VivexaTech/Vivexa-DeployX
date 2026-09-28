"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
};

/**
 * Client-side table with search, optional filter chips and pagination. Use for
 * bounded result sets that are already loaded on the server.
 */
export function DataTable<T>({
  rows,
  columns,
  searchKeys,
  searchPlaceholder = "Search…",
  filters,
  filterKey,
  pageSize = 20,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  rowKey,
  onRowClick,
}: {
  rows: T[];
  columns: Column<T>[];
  searchKeys?: ((row: T) => string | null | undefined)[];
  searchPlaceholder?: string;
  filters?: { value: string; label: string }[];
  filterKey?: (row: T) => string;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== "all" && filterKey && filterKey(row) !== filter) return false;
      if (!q || !searchKeys) return true;
      return searchKeys.some((fn) => (fn(row) ?? "").toLowerCase().includes(q));
    });
  }, [rows, query, filter, filterKey, searchKeys]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const visible = filtered.slice(current * pageSize, current * pageSize + pageSize);

  return (
    <div>
      {(searchKeys || filters) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-3">
          {searchKeys && (
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-soft" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder={searchPlaceholder}
                className="pl-9"
                aria-label="Search"
              />
            </div>
          )}
          {filters && (
            <div className="flex flex-wrap gap-1">
              {[{ value: "all", label: "All" }, ...filters].map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => {
                    setFilter(f.value);
                    setPage(0);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    filter === f.value
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
      )}

      {visible.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <Table>
          <THead>
            <tr>
              {columns.map((col) => (
                <TH key={col.key} className={col.className}>
                  {col.header}
                </TH>
              ))}
            </tr>
          </THead>
          <TBody>
            {visible.map((row) => (
              <TR
                key={rowKey(row)}
                className={onRowClick ? "cursor-pointer" : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <TD key={col.key} className={col.className}>
                    {col.cell(row)}
                  </TD>
                ))}
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {filtered.length > pageSize && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted">
          <span>
            {current * pageSize + 1}–{Math.min(filtered.length, (current + 1) * pageSize)} of {filtered.length}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setPage(current - 1)} disabled={current === 0} aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(current + 1)}
              disabled={current >= pageCount - 1}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
