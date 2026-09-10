import { addMonths, addYears } from "date-fns";
import { nanoid } from "nanoid";
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
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    { merge: true },
  );

  if (input.paymentId) {
    const paymentRef = db.collection(collections.payments).doc(input.paymentId);
    const paymentSnap = await paymentRef.get();
    if (paymentSnap.exists && paymentSnap.data()?.invoiced) {
      await userRef.set(
        {
          activePlanId: input.planId,
          activePlanName: plan?.planName ?? user.activePlanName,
          subscriptionId: input.razorpaySubscriptionId,
          subscriptionStatus: status,
          websiteLimit: plan?.maxWebsites ?? user.websiteLimit,
          updatedAt: nowIso(),
        },
        { merge: true },
      );
      return;
    }
    await paymentRef.set(
      {
        paymentId: input.paymentId,
        userId: input.userId,
        subscriptionId: input.razorpaySubscriptionId,
        planId: input.planId,
        amount,
        status: "captured",
        invoiced: true,
        createdAt: paymentSnap.data()?.createdAt ?? nowIso(),
      },
      { merge: true },
    );
  }

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
    paymentId: input.paymentId ?? null,
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
    const template = subscriptionSuccessEmail({
      name: user.name,
      planName: invoice.planName,
      amount,
      currency: invoice.currency,
      renewalDate,
      invoiceNumber: invoice.invoiceNumber,
    });
    await sendEmail({ to: user.email, ...template });
  }

  return invoice;
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

export async function sendDueRenewalReminders() {
  const db = getAdminDb();
  const target = new Date();
  target.setUTCDate(target.getUTCDate() + 10);
  const start = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  const snap = await db
    .collection(collections.subscriptions)
    .where("status", "==", "active")
    .where("renewalDate", ">=", start.toISOString())
    .where("renewalDate", "<", end.toISOString())
    .get();

  let sent = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const marker = start.toISOString().slice(0, 10);
    if (data.reminderSentForRenewal === marker) continue;
    const userSnap = await db.collection(collections.users).doc(String(data.userId)).get();
    const user = userSnap.data() as UserProfile | undefined;
    if (!user?.email) continue;
    if (["cancelled", "expired", "completed", "halted"].includes(String(data.status))) continue;
    const template = renewalReminderEmail({
      name: user.name,
      planName: user.activePlanName ?? "your plan",
      amount: Number(data.amount ?? 0),
      currency: String(data.currency ?? "INR"),
      renewalDate: String(data.renewalDate),
    });
    const result = await sendEmail({ to: user.email, ...template });
    if (!result.failed) {
      await doc.ref.set({ reminderSentForRenewal: marker, updatedAt: nowIso() }, { merge: true });
      await createNotification({
        uid: user.uid,
        type: "renewal_reminder",
        title: "Renewal in 10 days",
        message: `Your ${user.activePlanName ?? "subscription"} renews on ${String(data.renewalDate).slice(0, 10)}.`,
        href: "/dashboard/billing",
      });
      sent += 1;
    }
  }
  return sent;
}
