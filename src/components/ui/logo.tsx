import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg transition-transform group-hover:scale-105",
        className,
      )}
      aria-hidden="true"
    >
      <Image
        src="/logo-light.png"
        alt=""
        width={32}
        height={32}
        priority
        className="h-full w-full object-contain dark:hidden"
      />
      <Image
        src="/logo-dark.png"
        alt=""
        width={32}
        height={32}
        priority
        className="hidden h-full w-full object-contain dark:block"
      />
    </span>
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
