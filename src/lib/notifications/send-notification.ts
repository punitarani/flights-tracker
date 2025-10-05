import { env } from "@/env";
import { sendWithResend } from "./resend-client";
import { renderDailyPriceUpdateEmail } from "./templates/daily-price-update";
import { renderPriceDropAlertEmail } from "./templates/price-drop-alert";
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

function buildEmailContent(payload: NotificationEmailPayload) {
  switch (payload.type) {
    case "daily-price-update":
      return renderDailyPriceUpdateEmail(payload);
    case "price-drop-alert":
      return renderPriceDropAlertEmail(payload);
    default: {
      const _exhaustive: never = payload;
      throw new Error("Unsupported notification type");
    }
  }
}

export async function sendNotificationEmail(request: NotificationSendRequest) {
  const { subject, html, text } = buildEmailContent(request.payload);
  const fromAddress =
    env.RESEND_FROM_EMAIL ?? "Flight Alerts <alerts@resend.dev>";

  return await sendWithResend({
    from: fromAddress,
    to: formatRecipient(request.recipient),
    subject,
    html,
    text,
  });
}

export { renderDailyPriceUpdateEmail, renderPriceDropAlertEmail };
