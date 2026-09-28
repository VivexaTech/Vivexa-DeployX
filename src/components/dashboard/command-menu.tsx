"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CreditCard,
  FolderGit2,
  Globe,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Moon,
  Plus,
  Rocket,
  Search,
  Settings,
  Shield,
  Sun,
  BarChart3,
} from "lucide-react";
import { createPortal } from "react-dom";
import { signOutAction } from "@/app/auth/actions";
import { useTheme } from "@/components/theme/theme-provider";
import { Kbd } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

type Command = {
  id: string;
  label: string;
  group: string;
  icon: typeof Search;
  run: () => void;
  keywords?: string;
};

export function CommandMenu({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("deployx:command-menu", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("deployx:command-menu", onOpen);
    };
  }, []);

  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setActive(0);
    }
  }

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => router.push(href);
    const list: Command[] = [
      { id: "overview", label: "Go to Overview", group: "Navigation", icon: LayoutDashboard, run: go("/dashboard") },
      { id: "projects", label: "Go to Projects", group: "Navigation", icon: FolderGit2, run: go("/dashboard/projects") },
      { id: "deployments", label: "Go to Deployments", group: "Navigation", icon: Rocket, run: go("/dashboard/deployments") },
      { id: "domains", label: "Go to Domains", group: "Navigation", icon: Globe, run: go("/dashboard/domains") },
      { id: "analytics", label: "Go to Analytics", group: "Navigation", icon: BarChart3, run: go("/dashboard/analytics") },
      { id: "billing", label: "Billing", group: "Navigation", icon: CreditCard, run: go("/dashboard/billing"), keywords: "plan upgrade payment" },
      { id: "support", label: "Support", group: "Navigation", icon: LifeBuoy, run: go("/dashboard/support"), keywords: "help ticket" },
      { id: "settings", label: "Settings", group: "Navigation", icon: Settings, run: go("/dashboard/settings"), keywords: "profile github" },
      { id: "new-project", label: "Add Project", group: "Actions", icon: Plus, run: go("/dashboard/projects/new"), keywords: "import repository new" },
      { id: "add-domain", label: "Add Domain", group: "Actions", icon: Globe, run: go("/dashboard/domains?add=1"), keywords: "custom subdomain" },
      {
        id: "theme",
        label: resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        group: "Actions",
        icon: resolvedTheme === "dark" ? Sun : Moon,
        run: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
      },
      { id: "logout", label: "Logout", group: "Account", icon: LogOut, run: () => startTransition(() => signOutAction()), keywords: "sign out" },
    ];
    if (isAdmin) {
      list.splice(8, 0, { id: "admin", label: "Open Admin Panel", group: "Navigation", icon: Shield, run: go("/admin") });
    }
    return list;
  }, [router, isAdmin, resolvedTheme, setTheme]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(q));
  }, [commands, query]);

  const execute = (command: Command | undefined) => {
    if (!command) return;
    setOpen(false);
    command.run();
  };

  if (!open || typeof document === "undefined") return null;

  let lastGroup = "";
  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 animate-fade-in bg-black/50 backdrop-blur-[2px]" onClick={() => setOpen(false)} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="Command menu" className="relative w-full max-w-xl animate-slide-up overflow-hidden rounded-2xl border border-border bg-popover shadow-card">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                execute(filtered[active]);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Type a command or search…"
            className="h-12 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-soft"
            aria-label="Command"
          />
          <Kbd>Esc</Kbd>
        </div>
        <div className="scrollbar-thin max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted">No results for “{query}”</p>}
          {filtered.map((command, index) => {
            const header = command.group !== lastGroup ? command.group : null;
            lastGroup = command.group;
            const Icon = command.icon;
            return (
              <div key={command.id}>
                {header && <p className="px-3 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-soft uppercase">{header}</p>}
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => execute(command)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    index === active ? "bg-background-subtle text-foreground" : "text-muted",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{command.label}</span>
                  {index === active && <ArrowRight className="h-3.5 w-3.5" />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 border-t border-border bg-background-subtle px-4 py-2 text-[11px] text-muted-soft">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> select
          </span>
          <span className="ml-auto flex items-center gap-1">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function openCommandMenu() {
  window.dispatchEvent(new Event("deployx:command-menu"));
}
