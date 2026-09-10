import { cn } from "@/lib/utils";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "accent";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
        tone === "neutral" && "bg-accent-soft text-muted",
        tone === "success" && "bg-accent-soft text-success",
        tone === "warning" && "bg-[#fef0c7] text-warning dark:bg-[#3b2a10]",
        tone === "danger" && "bg-[#fee4e2] text-danger dark:bg-[#3b1613]",
        tone === "accent" && "bg-accent text-white dark:text-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function statusTone(status?: string | null) {
  const value = (status ?? "").toLowerCase();
  if (["ready", "active", "paid", "verified", "success"].includes(value)) return "success" as const;
  if (["pending", "building", "deploying", "queued", "past_due", "authenticated"].includes(value)) {
    return "warning" as const;
  }
  if (["error", "failed", "cancelled", "canceled", "halted", "expired"].includes(value)) {
    return "danger" as const;
  }
  return "neutral" as const;
}
