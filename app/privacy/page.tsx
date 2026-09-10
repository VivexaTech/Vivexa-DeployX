import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

export default function PrivacyPage() {
  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl font-semibold">Privacy Policy</h1>
        <p className="mt-4 text-sm text-muted">
          Draft notice for Vivexa DeployX / Vivexa Tech. Finalize with legal review before presenting this as a binding
          privacy statement.
        </p>
        <div className="mt-8 space-y-4 text-sm leading-7 text-muted">
          <p>
            We collect account data from Google authentication (name, email, and profile image), project metadata,
            deployment records, billing identifiers from Razorpay, and support messages you send us.
          </p>
          <p>
            GitHub access tokens and infrastructure credentials are stored server-side only. We do not put API secrets
            in browser code. Payment card details are handled by Razorpay, not stored in Firestore.
          </p>
          <p>
            Processors may include Firebase, Vercel, GitHub, Razorpay, and Resend. Retention follows operational need
            and any later written policy you publish.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
