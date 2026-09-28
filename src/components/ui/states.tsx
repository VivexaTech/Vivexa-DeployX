import { AlertTriangle, Inbox, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-background-subtle", className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background-subtle text-muted">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  action,
  className,
}: {
  title?: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-danger-soft text-danger">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Shown when an external integration is not configured (Development Mode). */
export function ConfigNotice({
  title,
  description,
  className,
}: {
  title: string;
  description: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-3 rounded-xl border border-warning/30 bg-warning-soft p-4", className)}>
      <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">
          <span className="mr-2 rounded bg-warning/15 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-warning uppercase">
            Development Mode
          </span>
          {title}
        </p>
        <div className="mt-1 text-[13px] leading-relaxed text-muted">{description}</div>
      </div>
    </div>
  );
}

export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: "info" | "danger" | "success" | "warning";
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    info: "border-info/25 bg-info-soft",
    danger: "border-danger/25 bg-danger-soft text-danger",
    success: "border-success/25 bg-success-soft text-success",
    warning: "border-warning/25 bg-warning-soft",
  };
  return <div className={cn("rounded-lg border px-3.5 py-2.5 text-[13px] leading-relaxed", tones[tone], className)}>{children}</div>;
}
