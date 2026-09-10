import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export default function TermsPage() {
  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl font-semibold">Terms of Service</h1>
        <p className="mt-4 text-sm text-muted">
          This is a working draft for Vivexa DeployX, a product of Vivexa Tech. It is not legal advice and must be
          reviewed by qualified counsel before production use.
        </p>
        <div className="mt-8 space-y-4 text-sm leading-7 text-muted">
          <p>
            Vivexa DeployX provides a branded interface for deploying websites from GitHub using Vercel as the
            underlying deployment infrastructure. Access is subject to an active, eligible subscription where
            required.
          </p>
          <p>
            You are responsible for the content of repositories you deploy, DNS records you configure, and compliance
            with GitHub, Vercel, Razorpay, and applicable law. Vivexa Tech may suspend access for abuse, unpaid
            invoices after any grace period, or security risk.
          </p>
          <p>
            These terms do not guarantee uptime, specific performance, or tax treatment of invoices. Payment processing
            is handled by Razorpay. Deployment execution is handled by Vercel.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
