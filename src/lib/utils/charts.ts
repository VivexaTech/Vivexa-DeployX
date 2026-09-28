import type { ChartPoint } from "@/components/ui/chart";

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Groups rows into one bucket per UTC day for the last `days` days (oldest first). */
export function bucketByDay<T>(rows: T[], days: number, getDate: (row: T) => string, getValue: (row: T) => number = () => 1): ChartPoint[] {
  const buckets = new Map<string, number>();
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    buckets.set(dayKey(d), 0);
  }
  for (const row of rows) {
    const key = getDate(row).slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + getValue(row));
  }
  return [...buckets.entries()].map(([key, value]) => {
    const d = new Date(`${key}T00:00:00Z`);
    return { label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }), value };
  });
}

export function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
