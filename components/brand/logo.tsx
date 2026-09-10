import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="relative grid h-8 w-8 place-items-center rounded-xl bg-accent text-white dark:text-ink">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
          <path d="M5 15l7-10 7 10H5z" fill="currentColor" opacity="0.95" />
          <path d="M8 18h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      {compact ? null : (
        <span>
          Vivexa <span className="text-accent">DeployX</span>
        </span>
      )}
    </span>
  );
}
