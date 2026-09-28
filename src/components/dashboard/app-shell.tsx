"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  ClipboardList,
  CreditCard,
  FolderGit2,
  Globe,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Package,
  Receipt,
  Repeat,
  Rocket,
  Search,
  Settings,
  Shield,
  TicketPercent,
  Users,
  X,
} from "lucide-react";
import { signOutAction } from "@/app/auth/actions";
import { Logo } from "@/components/ui/logo";
import { Avatar, Kbd } from "@/components/ui/misc";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { CommandMenu, openCommandMenu } from "@/components/dashboard/command-menu";
import { NotificationsDropdown } from "@/components/dashboard/notifications-dropdown";
import type { NavIcon, NavSection } from "@/components/dashboard/nav-config";
import { cn } from "@/lib/utils";

const ICONS: Record<NavIcon, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  projects: FolderGit2,
  deployments: Rocket,
  domains: Globe,
  analytics: BarChart3,
  billing: CreditCard,
  support: LifeBuoy,
  settings: Settings,
  users: Users,
  plans: Package,
  subscriptions: Repeat,
  payments: Receipt,
  coupons: TicketPercent,
  notifications: Bell,
  audit: ClipboardList,
  admin: Shield,
};

type ShellUser = { name: string | null; email: string; avatarUrl: string | null; isAdmin: boolean };

export function AppShell({
  nav,
  user,
  variant,
  banner,
  children,
}: {
  nav: NavSection[];
  user: ShellUser;
  variant: "dashboard" | "admin";
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  const [drawerPath, setDrawerPath] = useState(pathname);
  if (drawerPath !== pathname) {
    setDrawerPath(pathname);
    setDrawer(false);
  }

  return (
    <div className="min-h-screen bg-background">
      <CommandMenu isAdmin={user.isAdmin} />

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-background-subtle lg:flex">
        <SidebarContent nav={nav} user={user} variant={variant} pathname={pathname} />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-black/50" onClick={() => setDrawer(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 flex w-72 animate-slide-up flex-col border-r border-border bg-background-subtle">
            <button
              type="button"
              onClick={() => setDrawer(false)}
              className="absolute top-4 right-3 rounded-md p-1.5 text-muted hover:text-foreground"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent nav={nav} user={user} variant={variant} pathname={pathname} />
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="rounded-md p-1.5 text-muted hover:text-foreground lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="lg:hidden">
            <Logo compact href={variant === "admin" ? "/admin" : "/dashboard"} />
          </div>
          <button
            type="button"
            onClick={openCommandMenu}
            className="ml-auto flex h-8 w-full max-w-64 items-center gap-2 rounded-lg border border-border bg-background-subtle px-3 text-[13px] text-muted-soft transition-colors hover:border-border-strong hover:text-muted sm:ml-0"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="flex-1 text-left">Search…</span>
            <span className="hidden items-center gap-0.5 sm:flex">
              <Kbd>Ctrl</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <div className="flex items-center gap-1 sm:ml-auto">
            {variant === "admin" ? (
              <Link
                href="/dashboard"
                className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-muted hover:bg-background-subtle hover:text-foreground sm:flex"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" /> User dashboard
              </Link>
            ) : (
              user.isAdmin && (
                <Link
                  href="/admin"
                  className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-muted hover:bg-background-subtle hover:text-foreground sm:flex"
                >
                  <Shield className="h-3.5 w-3.5" /> Admin
                </Link>
              )
            )}
            <NotificationsDropdown />
          </div>
        </header>
        {banner}
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  nav,
  user,
  variant,
  pathname,
}: {
  nav: NavSection[];
  user: ShellUser;
  variant: "dashboard" | "admin";
  pathname: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <>
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <Logo href={variant === "admin" ? "/admin" : "/dashboard"} />
        {variant === "admin" && (
          <span className="ml-auto rounded border border-accent/30 bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] text-accent uppercase">
            Admin
          </span>
        )}
      </div>
      <nav className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Sidebar">
        {nav.map((section, i) => (
          <div key={section.title ?? i}>
            {section.title && (
              <p className="mb-1.5 px-2.5 text-[11px] font-medium tracking-wider text-muted-soft uppercase">{section.title}</p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = ICONS[item.icon];
                const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors",
                        active ? "bg-card font-medium text-foreground shadow-card" : "text-muted hover:bg-card/60 hover:text-foreground",
                      )}
                    >
                      <Icon className={cn("h-4 w-4", active ? "text-foreground" : "text-muted-soft")} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="space-y-3 border-t border-border p-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-muted">Theme</span>
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-2">
          <Avatar name={user.name} email={user.email} src={user.avatarUrl} size={30} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-foreground">{user.name || "Account"}</p>
            <p className="truncate text-[11px] text-muted">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={() => startTransition(() => signOutAction())}
            disabled={pending}
            className="rounded-md p-1.5 text-muted transition-colors hover:bg-background-subtle hover:text-foreground disabled:opacity-50"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}
