import { addMonths, addYears, differenceInCalendarDays } from "date-fns";
import { nanoid } from "nanoid";
import { RENEWAL_REMINDER_DAYS } from "@/config/constants";
import { utcDayKey, utcStartOfDay } from "@/lib/cron";
import { getPlanById } from "@/lib/content/public";
import { sendEmail } from "@/lib/email/resend";
import {
  paymentFailedEmail,
  renewalReminderEmail,
  subscriptionSuccessEmail,
} from "@/lib/email/templates";
import { getAdminDb } from "@/lib/firebase/admin";
import { collections, userInvoicesPath } from "@/lib/firebase/collections";
import { createNotification } from "@/lib/notifications/create";
import { logger } from "@/lib/logger";
import { nowIso } from "@/lib/utils";
import type { Invoice, SubscriptionStatus, UserProfile } from "@/types";

const REMINDER_ELIGIBLE_STATUSES = new Set(["active", "authenticated"]);
const REMINDER_INELIGIBLE_STATUSES = new Set([
  "cancelled",
  "canceled",
  "expired",
  "halted",
  "completed",
  "failed",
  "paused",
  "pending",
  "none",
]);

function nextRenewal(billingCycle: "monthly" | "yearly", from = new Date()) {
  return (billingCycle === "yearly" ? addYears(from, 1) : addMonths(from, 1)).toISOString();
}

function nextInvoiceNumber() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 12);
  return `VDX-${stamp}-${nanoid(4).toUpperCase()}`;
}

export async function applySubscriptionActivation(input: {
  userId: string;
  planId: string;
  razorpaySubscriptionId: string;
  paymentId?: string | null;
  amount?: number;
  status?: SubscriptionStatus;
  sendMail?: boolean;
}) {
  const db = getAdminDb();
  const plan = await getPlanById(input.planId);
  const userRef = db.collection(collections.users).doc(input.userId);
  const userSnap = await userRef.get();
  const user = userSnap.data() as UserProfile | undefined;
  if (!user) {
    logger.warn("Subscription activation skipped; user missing", { userId: input.userId });
    return;
  }

  const startDate = user.subscriptionStartDate ?? nowIso();
  const renewalDate = nextRenewal(plan?.billingCycle ?? "monthly");
  const amount = input.amount ?? plan?.planPrice ?? 0;
  const status = input.status ?? "active";

  await userRef.set(
    {
      activePlanId: input.planId,
      activePlanName: plan?.planName ?? user.activePlanName,
      subscriptionId: input.razorpaySubscriptionId,
      subscriptionStatus: status,
      subscriptionStartDate: startDate,
      renewalDate,
      websiteLimit: plan?.maxWebsites ?? user.websiteLimit,
      gracePeriodDays: plan?.gracePeriodDays ?? user.gracePeriodDays,
      updatedAt: nowIso(),
    },
    { merge: true },
  );

  await db.collection(collections.subscriptions).doc(input.razorpaySubscriptionId).set(
    {
      subscriptionId: input.razorpaySubscriptionId,
      userId: input.userId,
      planId: input.planId,
      razorpaySubscriptionId: input.razorpaySubscriptionId,
      razorpayPlanId: plan?.razorpayPlanId ?? "",
      status,
      startDate,
      renewalDate,
      amount,
      currency: plan?.currency ?? "INR",
      reminderSentForRenewal: null,
      reminderSentAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    { merge: true },
  );

  if (!input.paymentId) return { activated: true, invoice: null };

  try {
    const paymentRef = db.collection(collections.payments).doc(input.paymentId);
    const paymentSnap = await paymentRef.get();
    if (paymentSnap.exists && paymentSnap.data()?.invoiced) {
      return { activated: true, invoice: null, duplicate: true };
    }
    await paymentRef.set(
      {
        paymentId: input.paymentId,
        userId: input.userId,
        subscriptionId: input.razorpaySubscriptionId,
        planId: input.planId,
        amount,
        currency: plan?.currency ?? "INR",
        status: "captured",
        invoiced: true,
        createdAt: paymentSnap.data()?.createdAt ?? nowIso(),
      },
      { merge: true },
    );

    const invoiceId = nanoid();
    const invoice: Invoice = {
      invoiceId,
      invoiceNumber: nextInvoiceNumber(),
      userId: input.userId,
      customerName: user.name,
      customerEmail: user.email,
      planId: input.planId,
      planName: plan?.planName ?? "Subscription",
      amount,
      currency: plan?.currency ?? "INR",
      taxAmount: 0,
      taxLabel: null,
      paymentId: input.paymentId,
      subscriptionId: input.razorpaySubscriptionId,
      status: "paid",
      paymentDate: nowIso(),
      renewalDate,
      createdAt: nowIso(),
    };
    await db.collection(userInvoicesPath(input.userId)).doc(invoiceId).set(invoice);

    await createNotification({
      uid: input.userId,
      type: "subscription_activated",
      title: "Subscription activated",
      message: `${invoice.planName} is now active on your account.`,
      href: "/dashboard/billing",
    });

    if (input.sendMail !== false && user.email) {
      let attachments: { filename: string; content: Buffer }[] | undefined;
      try {
        const { generateInvoicePdf } = await import("@/lib/invoices/generate");
        attachments = [{ filename: `${invoice.invoiceNumber}.pdf`, content: await generateInvoicePdf(invoice) }];
      } catch (error) {
        logger.error("Invoice PDF generation failed; sending email without attachment", {
          message: error instanceof Error ? error.message : "unknown",
        });
      }
      const template = subscriptionSuccessEmail({
        name: user.name,
        planName: invoice.planName,
        amount,
        currency: invoice.currency,
        renewalDate,
        invoiceNumber: invoice.invoiceNumber,
      });
      const mailed = await sendEmail({ to: user.email, ...template, attachments });
      if (mailed.failed) {
        logger.warn("Invoice email failed after subscription activation; subscription stays active", {
          invoiceNumber: invoice.invoiceNumber,
        });
      }
    }
    return { activated: true, invoice };
  } catch (error) {
    logger.error("Invoice/email step failed after subscription activation", {
      name: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : "unknown",
    });
    return { activated: true, invoice: null };
  }
}

export async function applyPaymentFailure(input: {
  userId: string;
  planName?: string;
  razorpaySubscriptionId?: string | null;
}) {
  const db = getAdminDb();
  const userRef = db.collection(collections.users).doc(input.userId);
  const userSnap = await userRef.get();
  const user = userSnap.data() as UserProfile | undefined;
  if (!user) return;
  await userRef.set(
    {
      subscriptionStatus: user.subscriptionStatus === "active" ? "past_due" : "failed",
      updatedAt: nowIso(),
    },
    { merge: true },
  );
  if (input.razorpaySubscriptionId) {
    await db.collection(collections.subscriptions).doc(input.razorpaySubscriptionId).set(
      { status: "past_due", updatedAt: nowIso() },
      { merge: true },
    );
  }
  await createNotification({
    uid: input.userId,
    type: "payment_failed",
    title: "Payment failed",
    message: "We could not process your latest payment. Please update billing.",
    href: "/dashboard/billing",
  });
  if (user.email) {
    const template = paymentFailedEmail({
      name: user.name,
      planName: input.planName ?? user.activePlanName ?? "your plan",
    });
    await sendEmail({ to: user.email, ...template });
  }
}

export async function applySubscriptionStatus(
  razorpaySubscriptionId: string,
  status: SubscriptionStatus,
) {
  const db = getAdminDb();
  const ref = db.collection(collections.subscriptions).doc(razorpaySubscriptionId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const userId = String(snap.data()?.userId ?? "");
  await ref.set({ status, updatedAt: nowIso() }, { merge: true });
  if (userId) {
    await db.collection(collections.users).doc(userId).set(
      { subscriptionStatus: status, updatedAt: nowIso() },
      { merge: true },
    );
  }
}

function isReminderEligible(status: string) {
  if (REMINDER_INELIGIBLE_STATUSES.has(status)) return false;
  return REMINDER_ELIGIBLE_STATUSES.has(status);
}

export async function sendDueRenewalReminders() {
  const db = getAdminDb();
  const today = utcStartOfDay();
  const windowStart = new Date(today);
  windowStart.setUTCDate(windowStart.getUTCDate() + (RENEWAL_REMINDER_DAYS - 1));
  const windowEnd = new Date(today);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + RENEWAL_REMINDER_DAYS + 1);

  const snap = await db
    .collection(collections.subscriptions)
    .where("renewalDate", ">=", windowStart.toISOString())
    .where("renewalDate", "<", windowEnd.toISOString())
    .get();

  let sent = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const status = String(data.status ?? "");
    const renewalDate = String(data.renewalDate ?? "");
    const renewalKey = utcDayKey(renewalDate);
    if (!renewalKey) {
      skipped += 1;
      continue;
    }
    if (!isReminderEligible(status)) {
      skipped += 1;
      continue;
    }

    const daysUntil = differenceInCalendarDays(utcStartOfDay(new Date(renewalDate)), today);
    if (daysUntil !== RENEWAL_REMINDER_DAYS && daysUntil !== RENEWAL_REMINDER_DAYS - 1) {
      skipped += 1;
      continue;
    }

    if (data.reminderSentForRenewal === renewalKey && data.reminderSentAt) {
      skipped += 1;
      continue;
    }

    const userSnap = await db.collection(collections.users).doc(String(data.userId)).get();
    const user = userSnap.data() as UserProfile | undefined;
    if (!user?.email || !isReminderEligible(String(user.subscriptionStatus ?? ""))) {
      skipped += 1;
      continue;
    }

    const eventId = `${doc.id}_${renewalKey}`;
    const eventRef = db.collection(collections.renewalReminders).doc(eventId);
    const claimed = await db.runTransaction(async (tx) => {
      const eventSnap = await tx.get(eventRef);
      const event = eventSnap.data();
      if (event?.status === "completed") return false;
      if (event?.status === "processing") {
        const claimedAt = event.claimedAt ? new Date(String(event.claimedAt)).getTime() : 0;
        if (Date.now() - claimedAt < 30 * 60 * 1000) return false;
      }
      const subSnap = await tx.get(doc.ref);
      const latest = subSnap.data();
      if (!latest || !isReminderEligible(String(latest.status ?? ""))) return false;
      const latestRenewalKey = utcDayKey(String(latest.renewalDate ?? ""));
      if (latestRenewalKey !== renewalKey) return false;
      if (latest.reminderSentForRenewal === renewalKey && latest.reminderSentAt) return false;
      tx.set(
        eventRef,
        {
          eventId,
          subscriptionId: doc.id,
          userId: data.userId,
          renewalDate: renewalKey,
          status: "processing",
          claimedAt: nowIso(),
        },
        { merge: true },
      );
      return true;
    });

    if (!claimed) {
      skipped += 1;
      continue;
    }

    const template = renewalReminderEmail({
      name: user.name,
      planName: user.activePlanName ?? "your plan",
      amount: Number(data.amount ?? 0),
      currency: String(data.currency ?? "INR"),
      renewalDate,
    });
    const result = await sendEmail({ to: user.email, ...template });
    if (result.failed || result.skipped) {
      await eventRef.set(
        { status: result.failed ? "failed" : "unconfigured", failedAt: nowIso() },
        { merge: true },
      );
      logger.warn("Renewal reminder not delivered; will retry on the next daily run", {
        subscriptionId: doc.id,
        reason: result.failed ? "email_failed" : "resend_unconfigured",
      });
      continue;
    }

    const sentAt = nowIso();
    await eventRef.set({ status: "completed", sentAt }, { merge: true });
    await doc.ref.set(
      {
        reminderSentForRenewal: renewalKey,
        reminderSentAt: sentAt,
        updatedAt: sentAt,
      },
      { merge: true },
    );
    await createNotification({
      uid: user.uid,
      type: "renewal_reminder",
      title: "Renewal in 10 days",
      message: `Your ${user.activePlanName ?? "subscription"} renews on ${renewalKey}.`,
      href: "/dashboard/billing",
    });
    sent += 1;
  }

  return { sent, skipped, reminderDays: RENEWAL_REMINDER_DAYS };
}

export function mapRazorpaySubscriptionStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "authenticated":
      return "authenticated";
    case "active":
      return "active";
    case "halted":
      return "halted";
    case "cancelled":
    case "canceled":
      return "cancelled";
    case "completed":
      return "completed";
    case "paused":
      return "paused";
    case "expired":
      return "expired";
    case "pending":
    case "created":
    default:
      return "pending";
  }
}

export function razorpayStatusIsPaid(status: string) {
  return status === "authenticated" || status === "active";
}

export async function syncSubscriptionFromRazorpay(userId: string) {
  const db = getAdminDb();
  const userSnap = await db.collection(collections.users).doc(userId).get();
  const user = userSnap.data() as UserProfile | undefined;
  if (!user?.subscriptionId) {
    return { status: user?.subscriptionStatus ?? "none", synced: false };
  }
  const { getRazorpay } = await import("@/lib/razorpay/client");
  const remote = await getRazorpay().subscriptions.fetch(user.subscriptionId);
  const remoteStatus = String(remote.status ?? "");
  const local = await db.collection(collections.subscriptions).doc(user.subscriptionId).get();
  const planId = String(local.data()?.planId ?? user.activePlanId ?? "");
  if (razorpayStatusIsPaid(remoteStatus) && planId) {
    await applySubscriptionActivation({
      userId,
      planId,
      razorpaySubscriptionId: user.subscriptionId,
      status: mapRazorpaySubscriptionStatus(remoteStatus),
    });
    return { status: mapRazorpaySubscriptionStatus(remoteStatus), synced: true };
  }
  const mapped = mapRazorpaySubscriptionStatus(remoteStatus);
  if (mapped !== user.subscriptionStatus) {
    await applySubscriptionStatus(user.subscriptionId, mapped);
  }
  return { status: mapped, synced: mapped !== user.subscriptionStatus };
}
