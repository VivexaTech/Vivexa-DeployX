import { Badge, type BadgeTone } from "@/components/ui/badge";

const MAP: Record<string, { label: string; tone: BadgeTone; pulse?: boolean }> = {
  // deployments
  ready: { label: "Ready", tone: "success" },
  deploying: { label: "Deploying", tone: "warning", pulse: true },
  building: { label: "Building", tone: "warning", pulse: true },
  queued: { label: "Queued", tone: "neutral", pulse: true },
  error: { label: "Failed", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  // domains
  pending: { label: "Pending", tone: "neutral" },
  verifying: { label: "Verifying", tone: "warning", pulse: true },
  verified: { label: "Verified", tone: "success" },
  invalid: { label: "Invalid", tone: "danger" },
  // payments
  created: { label: "Pending", tone: "neutral" },
  paid: { label: "Successful", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  refunded: { label: "Refunded", tone: "info" },
  // subscriptions
  active: { label: "Active", tone: "success" },
  expired: { label: "Expired", tone: "danger" },
  // tickets
  open: { label: "Open", tone: "info" },
  in_progress: { label: "In progress", tone: "warning" },
  resolved: { label: "Resolved", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
  // accounts
  suspended: { label: "Suspended", tone: "danger" },
};

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  if (!status) return <Badge className={className}>Not deployed</Badge>;
  const entry = MAP[status] ?? { label: status, tone: "neutral" as BadgeTone };
  return (
    <Badge tone={entry.tone} dot pulse={entry.pulse} className={className}>
      {entry.label}
    </Badge>
  );
}
