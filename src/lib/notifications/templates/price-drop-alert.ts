import {
  escapeHtml,
  formatCurrency,
  formatDate,
  formatDateTime,
  joinWithAnd,
} from "../formatters";
import type { PriceDropAlertEmail } from "../types";
import { type RenderedEmail, renderEmail } from "./base";
import { renderFlightOptionsList } from "./shared";

function renderHero(payload: PriceDropAlertEmail): string {
  const { alert } = payload;
  const detectedLabel = formatDateTime(payload.detectedAt, {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });

  let priceSummary = "";
  if (payload.newLowestPrice) {
    const newPrice = formatCurrency(
      payload.newLowestPrice.amount,
      payload.newLowestPrice.currency,
    );
    if (payload.previousLowestPrice) {
      const previousPrice = formatCurrency(
        payload.previousLowestPrice.amount,
        payload.previousLowestPrice.currency,
      );
      priceSummary = `<div style="font-size:14px; color:#4338ca; margin-top:12px;">New low price ${escapeHtml(newPrice)} (was ${escapeHtml(previousPrice)})</div>`;
    } else {
      priceSummary = `<div style="font-size:14px; color:#4338ca; margin-top:12px;">Lowest available price ${escapeHtml(newPrice)}</div>`;
    }
  }

  const filters: string[] = [];
  if (alert.seatType) filters.push(alert.seatType);
  if (alert.stops) filters.push(alert.stops);
  if (alert.airlines && alert.airlines.length > 0) {
    filters.push(`Airlines: ${joinWithAnd(alert.airlines)}`);
  }
  if (alert.priceLimit) {
    filters.push(
      `Target: ${formatCurrency(alert.priceLimit.amount, alert.priceLimit.currency)}`,
    );
  }

  const filtersHtml = filters.length
    ? `<div style="margin-top:10px;">${filters
        .map((label) => `<span class="badge">${escapeHtml(label)}</span>`)
        .join(" ")}</div>`
    : "";

  return `<section style="padding:32px 28px; border-bottom:1px solid #e2e8f0; background:linear-gradient(135deg, #eef2ff 0%, #fff 100%);">
    <div style="font-size:13px; color:#64748b; text-transform:uppercase; letter-spacing:0.1em;">Price drop detected</div>
    <h1 style="margin:8px 0 0; font-size:22px; color:#0f172a;">${escapeHtml(
      alert.origin,
    )} → ${escapeHtml(alert.destination)}</h1>
    <div style="font-size:14px; color:#475569; margin-top:6px;">Alert: ${escapeHtml(
      alert.label,
    )}</div>
    <div style="font-size:13px; color:#64748b; margin-top:6px;">Updated ${escapeHtml(
      detectedLabel,
    )}</div>
    ${filtersHtml}
    ${priceSummary}
  </section>`;
}

export function renderPriceDropAlertEmail(
  payload: PriceDropAlertEmail,
): RenderedEmail {
  const subject = `Price drop: ${payload.alert.origin} → ${payload.alert.destination}`;
  const previewParts: string[] = [];

  if (payload.newLowestPrice) {
    previewParts.push(
      formatCurrency(
        payload.newLowestPrice.amount,
        payload.newLowestPrice.currency,
        { maximumFractionDigits: 0 },
      ),
    );
  }

  previewParts.push(formatDate(payload.detectedAt));

  const body = `
    ${renderHero(payload)}
    <section class="content">
      <p style="margin:0 0 16px;">Here are the best matches right now. Prices can change quickly, so book soon if any option works for you.</p>
      ${renderFlightOptionsList(payload.flights)}
    </section>
  `;

  return renderEmail(subject, {
    title: subject,
    previewText: previewParts.join(" • "),
    body,
  });
}
