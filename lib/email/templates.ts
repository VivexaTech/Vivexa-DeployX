import { COMPANY_NAME, PLATFORM_NAME } from "@/config/constants";
import { getAppUrl } from "@/lib/env";
import { formatCurrency, formatDate } from "@/lib/utils";

function layout(title: string, body: string) {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#0b1210;font-family:Arial,sans-serif;color:#e8f0ec;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:#121a17;border:1px solid #1e2a26;border-radius:16px;padding:32px;">
            <tr>
              <td>
                <p style="margin:0 0 8px;color:#3ddc97;font-size:12px;letter-spacing:.12em;text-transform:uppercase;">${PLATFORM_NAME}</p>
                <h1 style="margin:0 0 16px;font-size:24px;color:#e8f0ec;">${title}</h1>
                ${body}
                <p style="margin:32px 0 0;color:#8a9a94;font-size:12px;">${COMPANY_NAME} · ${PLATFORM_NAME}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(href: string, label: string) {
  return `<p style="margin:24px 0 0;"><a href="${href}" style="display:inline-block;background:#0f6e56;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;">${label}</a></p>`;
}

export function subscriptionSuccessEmail(input: {
  name: string;
  planName: string;
  amount: number;
  currency: string;
  renewalDate: string | null;
  invoiceNumber: string;
}) {
  return {
    subject: `Your ${PLATFORM_NAME} ${input.planName} plan is active`,
    html: layout(
      "Thank you for subscribing",
      `<p>Hi ${input.name},</p>
       <p>Your <strong>${input.planName}</strong> plan is now active on ${PLATFORM_NAME}.</p>
       <p>Amount: <strong>${formatCurrency(input.amount, input.currency)}</strong><br/>
       Invoice: <strong>${input.invoiceNumber}</strong><br/>
       ${input.renewalDate ? `Renews on: <strong>${formatDate(input.renewalDate)}</strong>` : ""}</p>
       ${button(`${getAppUrl()}/dashboard/billing`, "Manage billing")}`,
    ),
  };
}

export function paymentFailedEmail(input: { name: string; planName: string }) {
  return {
    subject: `Payment failed for your ${PLATFORM_NAME} subscription`,
    html: layout(
      "Payment unsuccessful",
      `<p>Hi ${input.name},</p>
       <p>We could not process the payment for your <strong>${input.planName}</strong> subscription. Your sites stay online during any configured grace period, but new deployments may be limited until billing is updated.</p>
       ${button(`${getAppUrl()}/dashboard/billing`, "Update billing")}`,
    ),
  };
}

export function renewalReminderEmail(input: {
  name: string;
  planName: string;
  amount: number;
  currency: string;
  renewalDate: string;
}) {
  return {
    subject: `Your ${PLATFORM_NAME} subscription renews in 10 days`,
    html: layout(
      "Renewal reminder",
      `<p>Hi ${input.name},</p>
       <p>Your <strong>${input.planName}</strong> subscription renews in 10 days on <strong>${formatDate(input.renewalDate)}</strong>.</p>
       <p>Expected amount: <strong>${formatCurrency(input.amount, input.currency)}</strong></p>
       ${button(`${getAppUrl()}/dashboard/billing`, "Manage billing")}`,
    ),
  };
}
