import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { siteConfig } from "@/lib/site";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden />
      <header className="relative flex h-16 items-center justify-between px-5 sm:px-8">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="relative flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-[400px] animate-slide-up">{children}</div>
      </main>
      <footer className="relative px-5 py-6 text-center text-xs text-muted-soft">
        Powered by {siteConfig.company} ·{" "}
        <Link href="/terms" className="hover:text-foreground">
          Terms
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="hover:text-foreground">
          Privacy
        </Link>
      </footer>
    </div>
  );
}
