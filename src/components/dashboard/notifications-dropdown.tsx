"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { Dropdown } from "@/components/ui/dropdown";
import { Skeleton } from "@/components/ui/states";
import { cn, timeAgo } from "@/lib/utils";
import type { Notification } from "@/types/database";

export function NotificationsDropdown() {
  const [items, setItems] = useState<Notification[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { notifications: Notification[] };
      setItems(data.notifications);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const id = setInterval(load, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  const unread = items?.filter((n) => !n.read_at).length ?? 0;

  const markAll = async () => {
    setItems((prev) => prev?.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })) ?? null);
    await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
  };

  const markOne = async (id: string) => {
    setItems((prev) => prev?.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)) ?? null);
    await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
  };

  return (
    <Dropdown
      className="w-[min(22rem,calc(100vw-2rem))] p-0"
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={() => {
            toggle();
            if (!open) load();
          }}
          className="relative rounded-lg p-2 text-muted transition-colors hover:bg-background-subtle hover:text-foreground"
          aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent ring-2 ring-background" />}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="flex items-center gap-1 text-xs text-muted hover:text-foreground">
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="scrollbar-thin max-h-96 overflow-y-auto">
            {error && <p className="px-4 py-8 text-center text-[13px] text-muted">Couldn&apos;t load notifications.</p>}
            {!error && items === null && (
              <div className="space-y-3 p-4">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            )}
            {!error && items?.length === 0 && <p className="px-4 py-10 text-center text-[13px] text-muted">You&apos;re all caught up.</p>}
            {items?.map((n) => {
              const content = (
                <div className="flex gap-3">
                  <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-accent")} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-foreground">{n.title}</p>
                    {n.body && <p className="mt-0.5 line-clamp-2 text-xs break-words text-muted">{n.body}</p>}
                    <p className="mt-1 text-[11px] text-muted-soft">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              );
              const className = "block border-b border-border px-4 py-3 last:border-0 hover:bg-background-subtle";
              return n.link ? (
                <Link
                  key={n.id}
                  href={n.link}
                  className={className}
                  onClick={() => {
                    if (!n.read_at) markOne(n.id);
                    close();
                  }}
                >
                  {content}
                </Link>
              ) : (
                <button key={n.id} type="button" className={cn(className, "w-full text-left")} onClick={() => !n.read_at && markOne(n.id)}>
                  {content}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Dropdown>
  );
}
