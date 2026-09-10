import { Resend } from "resend";
import { readEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

let resend: Resend | null = null;

export function emailConfigured() {
  return Boolean(readEnv("RESEND_API_KEY") && readEnv("RESEND_FROM_EMAIL"));
}

function getClient() {
  if (!emailConfigured()) return null;
  if (!resend) resend = new Resend(readEnv("RESEND_API_KEY"));
  return resend;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
}) {
  const client = getClient();
  if (!client) {
    logger.warn("Resend is not configured; email skipped", { subject: input.subject });
    return { skipped: true };
  }
  try {
    await client.emails.send({
      from: `${readEnv("RESEND_FROM_NAME") || "Vivexa DeployX"} <${readEnv("RESEND_FROM_EMAIL")}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      attachments: input.attachments?.map((item) => ({
        filename: item.filename,
        content: item.content,
      })),
    });
    return { skipped: false };
  } catch (error) {
    logger.error("Resend email failed", {
      subject: input.subject,
      message: error instanceof Error ? error.message : "unknown",
    });
    return { skipped: true, failed: true };
  }
}
