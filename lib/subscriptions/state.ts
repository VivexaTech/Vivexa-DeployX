import type { SubscriptionStatus } from "@/types";

const PAID_STATUSES = new Set<SubscriptionStatus>(["active", "authenticated"]);

export function isPaidSubscriptionStatus(status: string) {
  return PAID_STATUSES.has(status as SubscriptionStatus);
}

export function paidPeriodOpen(renewalDate?: string | null, currentEnd?: number | string | null) {
  if (typeof currentEnd === "number" && currentEnd > 0) {
    return currentEnd * 1000 > Date.now();
  }
  if (typeof currentEnd === "string" && currentEnd) {
    const parsed = Number(currentEnd);
    if (Number.isFinite(parsed) && parsed > 1_000_000_000) return parsed * 1000 > Date.now();
    const date = Date.parse(currentEnd);
    if (Number.isFinite(date)) return date > Date.now();
  }
  if (!renewalDate) return false;
  const date = Date.parse(renewalDate);
  return Number.isFinite(date) && date > Date.now();
}

export type RemoteSubscriptionSnapshot = {
  status: string;
  paidCount: number;
  currentEnd?: number | string | null;
  planId?: string;
};

export type StatusDecision = {
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  applyToUser: boolean;
  reason: string;
};

export function decideSubscriptionStatus(input: {
  localStatus: string;
  incoming: SubscriptionStatus;
  paidCount: number;
  renewalDate?: string | null;
  currentEnd?: number | string | null;
  isCurrentSubscription: boolean;
  explicitCancel?: boolean;
}): StatusDecision {
  const local = input.localStatus as SubscriptionStatus;
  const covered = paidPeriodOpen(input.renewalDate, input.currentEnd);
  const hasPaidCycle = input.paidCount >= 1 || isPaidSubscriptionStatus(local);

  if (!input.isCurrentSubscription) {
    return {
      status: input.incoming,
      cancelAtPeriodEnd: input.incoming === "cancelled" || input.incoming === "completed",
      applyToUser: false,
      reason: "not_current_subscription",
    };
  }

  if (input.explicitCancel) {
    return {
      status: "cancelled",
      cancelAtPeriodEnd: false,
      applyToUser: true,
      reason: "explicit_cancel",
    };
  }

  if (
    (input.incoming === "cancelled" || input.incoming === "completed") &&
    hasPaidCycle
  ) {
    const unknownEnd = !input.renewalDate && (input.currentEnd == null || input.currentEnd === "");
    if (covered || unknownEnd) {
      return {
        status: isPaidSubscriptionStatus(local) ? local : "active",
        cancelAtPeriodEnd: true,
        applyToUser: true,
        reason: unknownEnd ? "preserve_paid_period_unknown_end" : "preserve_paid_period",
      };
    }
  }

  if (
    (input.incoming === "pending" || input.incoming === "none") &&
    isPaidSubscriptionStatus(local)
  ) {
    return {
      status: local,
      cancelAtPeriodEnd: false,
      applyToUser: false,
      reason: "ignore_unpaid_downgrade",
    };
  }

  if (input.incoming === "failed" && isPaidSubscriptionStatus(local) && covered) {
    return {
      status: "past_due",
      cancelAtPeriodEnd: false,
      applyToUser: true,
      reason: "failed_renewal",
    };
  }

  return {
    status: input.incoming,
    cancelAtPeriodEnd: input.incoming === "cancelled" || input.incoming === "completed",
    applyToUser: true,
    reason: "apply_remote",
  };
}
