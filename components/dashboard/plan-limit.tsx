import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function PlanLimitCard({
  used,
  limit,
  planName,
}: {
  used?: number;
  limit?: number;
  planName?: string;
}) {
  return (
    <Card className="border-warning/40 p-6">
      <h3 className="text-lg font-semibold">You&apos;ve reached your current plan limit</h3>
      <p className="mt-2 text-sm text-muted">
        You&apos;re using {used ?? "all"} of {limit ?? "your"} websites included in your {planName ?? "current"} plan.
        Upgrade your plan to deploy more websites.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/dashboard/billing">
          <Button>Upgrade Plan</Button>
        </Link>
        <Link href="/#pricing">
          <Button variant="secondary">View Pricing</Button>
        </Link>
      </div>
    </Card>
  );
}
