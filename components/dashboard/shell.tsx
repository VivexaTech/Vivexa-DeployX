"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  CreditCard,
  FolderGit2,
  GitBranch,
  Globe,
  HelpCircle,
  LayoutDashboard,
  Menu,
  Receipt,
  Rocket,
  Search,
  Settings,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/providers/auth-provider";
import { apiFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/projects", label: "Projects", icon: FolderGit2 },
  { href: "/dashboard/deployments", label: "Deployments", icon: Rocket },
  { href: "/dashboard/domains", label: "Domains", icon: Globe },
  { href: "/dashboard/github", label: "GitHub", icon: GitBranch },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/invoices", label: "Invoices", icon: Receipt },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/support", label: "Support", icon: HelpCircle },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [query, setQuery] = useState("");
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch("/api/me")
      .then(() => {
        if (active) setAllowed(true);
      })
      .catch(() => {
        if (active) router.replace("/login");
      });
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    apiFetch<{ unread: number }>("/api/notifications")
      .then((data) => setUnread(data.unread))
      .catch(() => undefined);
  }, [pathname]);

  const sidebar = (
    <aside className="flex h-full w-72 flex-col border-r border-line bg-bg-elevated">
      <div className="flex h-16 items-center justify-between px-5">
        <Link href="/dashboard">
          <Logo />
        </Link>
        <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close sidebar">
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-3">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-muted hover:bg-accent-soft hover:text-ink",
                active && "bg-accent-soft font-semibold text-ink",
              )}
            >
              <span className="inline-flex items-center gap-3">
                <Icon className="h-4 w-4" />
                {item.label}
              </span>
              {item.href === "/dashboard/notifications" && unread > 0 ? (
                <span className="rounded-full bg-accent px-2 text-[11px] text-white dark:text-ink">{unread}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );

  if (!allowed) {
    return (
      <div className="grid min-h-screen place-items-center">
        <p className="text-sm text-muted">Loading your workspace…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg lg:grid lg:grid-cols-[18rem_1fr]">
      <div className="hidden lg:block">{sidebar}</div>
      {open ? <div className="fixed inset-0 z-50 lg:hidden">{sidebar}</div> : null}
      <div>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-bg/90 px-4 backdrop-blur">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open sidebar">
            <Menu />
          </button>
          <form
            className="relative flex-1"
            onSubmit={(event) => {
              event.preventDefault();
              router.push(`/dashboard/projects?q=${encodeURIComponent(query)}`);
            }}
          >
            <Search className="absolute top-3 left-3 h-4 w-4 text-muted" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects"
              className="pl-9"
              aria-label="Search projects"
            />
          </form>
          <Link href="/dashboard/notifications" className="relative rounded-xl border border-line p-2">
            <Bell className="h-4 w-4" />
            {unread > 0 ? <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-accent" /> : null}
          </Link>
          <ThemeToggle compact />
          <div className="flex items-center gap-2">
            <span className="hidden text-sm sm:inline">{user?.displayName ?? "Account"}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                logout().then(() => {
                  router.replace("/");
                  router.refresh();
                })
              }
            >
              Sign out
            </Button>
          </div>
        </header>
        <div className="px-4 py-6 md:px-8">{children}</div>
      </div>
    </div>
  );
}
