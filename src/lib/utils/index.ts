import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amountInSmallestUnit: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: amountInSmallestUnit % 100 === 0 ? 0 : 2,
  }).format(amountInSmallestUnit / 100);
}

/** Always two decimals (₹1,299.00) — for checkout summaries and invoices. */
export function formatMoney(amountInSmallestUnit: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    amountInSmallestUnit / 100,
  );
}

export function formatDate(value: string | Date | null | undefined, withTime = false): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

export function timeAgo(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return "just now";
  const units: [number, string][] = [
    [60, "minute"],
    [3600, "hour"],
    [86400, "day"],
    [604800, "week"],
    [2629800, "month"],
    [31557600, "year"],
  ];
  let unit = "minute";
  let divisor = 60;
  for (const [size, name] of units) {
    if (seconds >= size) {
      unit = name;
      divisor = size;
    }
  }
  const valueInUnit = Math.max(1, Math.floor(seconds / divisor));
  return `${valueInUnit} ${unit}${valueInUnit === 1 ? "" : "s"} ago`;
}

export function isPast(value: string | null | undefined): boolean {
  return Boolean(value) && new Date(value as string).getTime() < Date.now();
}

/** Whole days remaining until `value` (0 once passed), or null when there is no date. */
export function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000));
}

export function formatDuration(start: string | null, end: string | null): string {
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms <= 0) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function slugify(input: string, maxLength = 48): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

export function shortSha(sha: string | null | undefined): string {
  return sha ? sha.slice(0, 7) : "—";
}

export function ensureUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.startsWith("http") ? value : `https://${value}`;
}

export function formatLimit(value: number | null | undefined, suffix = ""): string {
  if (value === null || value === undefined) return "Unlimited";
  return `${value.toLocaleString("en-IN")}${suffix}`;
}

export function initials(name: string | null | undefined, email?: string): string {
  const source = (name || email || "?").trim();
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}
