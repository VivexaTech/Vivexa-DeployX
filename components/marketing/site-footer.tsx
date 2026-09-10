import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { COMPANY_NAME, PLATFORM_NAME } from "@/config/constants";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-bg-elevated">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 md:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-3 text-sm text-muted">
            A {COMPANY_NAME} platform for GitHub-based website deployment.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold">Product</p>
          <div className="mt-3 flex flex-col gap-2 text-sm text-muted">
            <Link href="/#features">Features</Link>
            <Link href="/#pricing">Pricing</Link>
            <Link href="/#projects">Projects</Link>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold">Company</p>
          <div className="mt-3 flex flex-col gap-2 text-sm text-muted">
            <Link href="/#about">{COMPANY_NAME}</Link>
            <Link href="/#support">Support</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold">Account</p>
          <div className="mt-3 flex flex-col gap-2 text-sm text-muted">
            <Link href="/login">Login</Link>
            <Link href="/signup">Get Started</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} {COMPANY_NAME}. {PLATFORM_NAME}. All rights reserved.
      </div>
    </footer>
  );
}
