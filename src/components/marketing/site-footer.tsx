import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { siteConfig } from "@/lib/site";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/pricing", label: "Pricing" },
      { href: "/docs", label: "Documentation" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
      { href: "/acceptable-use", label: "Acceptable Use" },
      { href: "/refund-policy", label: "Refund Policy" },
      { href: "/infrastructure", label: "Infrastructure Disclosure" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background-subtle">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">{siteConfig.tagline}</p>
            <p className="mt-1 text-sm text-muted-soft">Powered by {siteConfig.company}</p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-[13px] font-medium text-foreground">{col.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-muted transition-colors hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 border-t border-border pt-6">
          <p className="max-w-3xl text-xs leading-relaxed text-muted-soft">{siteConfig.infrastructureDisclosure}</p>
          <p className="mt-3 text-xs text-muted-soft">
            © {new Date().getFullYear()} {siteConfig.company}. All rights reserved. Built for modern cloud deployment workflows.
          </p>
        </div>
      </div>
    </footer>
  );
}
