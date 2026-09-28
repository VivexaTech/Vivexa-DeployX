import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("h-7 w-7", className)}>
      <rect width="32" height="32" rx="8" className="fill-foreground" />
      <path d="M9 9.5h6.2c4.1 0 6.8 2.7 6.8 6.5s-2.7 6.5-6.8 6.5H9z" className="fill-none stroke-background" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M19.5 9.5l4 4m0 5l-4 4" className="stroke-accent" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ href = "/", className, compact }: { href?: string; className?: string; compact?: boolean }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)} aria-label="Vivexa DeployX home">
      <LogoMark />
      {!compact && (
        <span className="flex items-baseline gap-1 text-[15px] font-semibold tracking-tight text-foreground">
          <span className="text-muted">Vivexa</span>
          <span>DeployX</span>
        </span>
      )}
    </Link>
  );
}
