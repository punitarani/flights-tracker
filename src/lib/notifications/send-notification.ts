import {
  renderDailyDigestEmailWithAI,
  renderPriceDropEmailWithAI,
} from "./ai-email-service";
import { sendWithResend } from "./resend-client";
import type {
  NotificationEmailPayload,
  NotificationSendRequest,
} from "./types";

function formatRecipient(
  recipient: NotificationSendRequest["recipient"],
): string {
  if (recipient.name) {
    return `${recipient.name} <${recipient.email}>`;
  }
  return recipient.email;
}

async function buildEmailContent(payload: NotificationEmailPayload) {
  switch (payload.type) {
    case "daily-price-update":
      return await renderDailyDigestEmailWithAI(payload);
    case "price-drop-alert":
      return await renderPriceDropEmailWithAI(payload);
    default: {
      const _exhaustive: never = payload;
      throw new Error("Unsupported notification type");
    }
  }
}

export async function sendNotificationEmail(request: NotificationSendRequest) {
  const { subject, html, text } = await buildEmailContent(request.payload);
  const fromAddress =
    process.env.RESEND_FROM_EMAIL ?? "Flight Alerts <alerts@resend.dev>";

  return await sendWithResend({
    from: fromAddress,
    to: formatRecipient(request.recipient),
    subject,
    html,
    text,
  });
}
