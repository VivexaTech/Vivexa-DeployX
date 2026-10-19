import { Wrench } from "lucide-react";
import type { IntegrationStatus } from "@/lib/env";

const LABELS: Record<keyof IntegrationStatus, string> = {
  supabase: "Supabase service role",
  github: "GitHub OAuth",
  vercel: "Deployment Engine",
  razorpay: "Razorpay",
  encryption: "ENCRYPTION_KEY",
};

/** Lists integrations that aren't configured so nothing appears to work when it doesn't. */
export function DevModeBanner({ status, maintenance }: { status: IntegrationStatus; maintenance: boolean }) {
  const missing = (Object.keys(status) as (keyof IntegrationStatus)[]).filter((k) => !status[k]);
  if (missing.length === 0 && !maintenance) return null;
  return (
    <div className="space-y-px">
      {maintenance && (
        <div className="border-b border-warning/30 bg-warning-soft px-4 py-2 text-center text-[13px] text-foreground sm:px-6">
          Maintenance mode is enabled. Deployments are temporarily paused.
        </div>
      )}
      {missing.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-background-subtle px-4 py-2 text-xs text-muted sm:px-6">
          <span className="flex items-center gap-1.5 font-medium text-warning">
            <Wrench className="h-3.5 w-3.5" /> Development Mode
          </span>
          <span>Not configured: {missing.map((k) => LABELS[k]).join(", ")}. Related features are disabled until configured.</span>
        </div>
      )}
    </div>
  );
}
