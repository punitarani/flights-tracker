import {
  escapeHtml,
  formatCurrency,
  formatDate,
  formatDateTime,
  joinWithAnd,
} from "../formatters";
import type { DailyPriceUpdateEmail } from "../types";
import { type RenderedEmail, renderEmail } from "./base";
import { renderFlightOptionsList } from "./shared";

function renderBadge(label: string): string {
  return `<span class="badge">${escapeHtml(label)}</span>`;
}

function renderFilters(
  payload: DailyPriceUpdateEmail["alerts"][number],
): string {
  const { alert } = payload;
  const badges: string[] = [];

  if (alert.seatType) {
    badges.push(renderBadge(alert.seatType));
  }

  if (alert.stops) {
    badges.push(renderBadge(alert.stops));
  }

  if (alert.airlines && alert.airlines.length > 0) {
    badges.push(renderBadge(`Airlines: ${joinWithAnd(alert.airlines)}`));
  }

  if (alert.priceLimit) {
    const formatted = formatCurrency(
      alert.priceLimit.amount,
      alert.priceLimit.currency,
    );
    badges.push(renderBadge(`Max ${formatted}`));
  }

  return badges.length
    ? `<div style="margin-top:10px;">${badges.join(" ")}</div>`
    : "";
}

function renderAlertSection(
  alertSummary: DailyPriceUpdateEmail["alerts"][number],
): string {
  const generated = formatDateTime(alertSummary.generatedAt, {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });

  return `<section style="padding:24px 28px;">
    <div style="padding:0 0 16px; border-bottom:1px solid #e2e8f0;">
      <h1>${escapeHtml(alertSummary.alert.label)}</h1>
      <div style="font-size:13px; color:#475569; margin-top:6px;">
        ${escapeHtml(alertSummary.alert.origin)} → ${escapeHtml(alertSummary.alert.destination)} • Updated ${escapeHtml(generated)}
      </div>
      ${renderFilters(alertSummary)}
    </div>
    <div class="content">
      ${renderFlightOptionsList(alertSummary.flights)}
    </div>
  </section>`;
}

export function renderDailyPriceUpdateEmail(
  payload: DailyPriceUpdateEmail,
): RenderedEmail {
  const subject = `Daily update: ${formatDate(payload.summaryDate)} alerts`;
  const previewText = payload.alerts.length
    ? `Top matches for ${payload.alerts.length} active alert${payload.alerts.length > 1 ? "s" : ""}.`
    : "No new matches today.";

  const alertsContent = payload.alerts.length
    ? payload.alerts
        .map((summary) => renderAlertSection(summary))
        .join('<div class="divider"></div>')
    : `<section class="content" style="padding:28px;">
        <div style="padding:20px; border:1px dashed #cbd5f5; border-radius:10px; color:#64748b; font-size:14px; text-align:center;">
          No new flight matches were found in the past day.
        </div>
      </section>`;

  const body = `
    <section class="header" style="padding:24px 28px; border-bottom:1px solid #e2e8f0;">
      <h1 style="margin:0;">Daily flight price update</h1>
      <p style="margin:6px 0 0; font-size:14px; color:#475569;">Summary for ${escapeHtml(formatDate(payload.summaryDate))}</p>
    </section>
    ${alertsContent}
  `;

  return renderEmail(subject, {
    title: subject,
    previewText,
    body,
  });
}
