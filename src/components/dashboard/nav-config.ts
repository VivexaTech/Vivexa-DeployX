export type NavIcon =
  | "overview"
  | "projects"
  | "deployments"
  | "domains"
  | "analytics"
  | "billing"
  | "support"
  | "settings"
  | "users"
  | "plans"
  | "subscriptions"
  | "payments"
  | "coupons"
  | "notifications"
  | "audit"
  | "admin";

export type NavItem = { href: string; label: string; icon: NavIcon; exact?: boolean };
export type NavSection = { title?: string; items: NavItem[] };

export const DASHBOARD_NAV: NavSection[] = [
  { items: [{ href: "/dashboard", label: "Overview", icon: "overview", exact: true }] },
  {
    items: [
      { href: "/dashboard/projects", label: "Projects", icon: "projects" },
      { href: "/dashboard/deployments", label: "Deployments", icon: "deployments" },
      { href: "/dashboard/domains", label: "Domains", icon: "domains" },
    ],
  },
  { items: [{ href: "/dashboard/analytics", label: "Analytics", icon: "analytics" }] },
  { items: [{ href: "/dashboard/billing", label: "Billing", icon: "billing" }] },
  {
    items: [
      { href: "/dashboard/support", label: "Support", icon: "support" },
      { href: "/dashboard/settings", label: "Settings", icon: "settings" },
    ],
  },
];

export const ADMIN_NAV: NavSection[] = [
  { items: [{ href: "/admin", label: "Dashboard", icon: "overview", exact: true }] },
  {
    title: "Customers",
    items: [
      { href: "/admin/users", label: "Users", icon: "users" },
      { href: "/admin/subscriptions", label: "Subscriptions", icon: "subscriptions" },
      { href: "/admin/payments", label: "Payments", icon: "payments" },
    ],
  },
  {
    title: "Platform",
    items: [
      { href: "/admin/plans", label: "Plans", icon: "plans" },
      { href: "/admin/coupons", label: "Coupons", icon: "coupons" },
      { href: "/admin/projects", label: "Projects", icon: "projects" },
      { href: "/admin/deployments", label: "Deployments", icon: "deployments" },
      { href: "/admin/domains", label: "Domains", icon: "domains" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/admin/support", label: "Support", icon: "support" },
      { href: "/admin/notifications", label: "Notifications", icon: "notifications" },
      { href: "/admin/audit-logs", label: "Audit Logs", icon: "audit" },
      { href: "/admin/settings", label: "Settings", icon: "settings" },
    ],
  },
];
