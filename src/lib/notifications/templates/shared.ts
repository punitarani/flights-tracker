import {
  escapeHtml,
  formatCurrency,
  formatDateTime,
  formatDuration,
} from "../formatters";
import type { FlightOptionSummary } from "../types";

function renderLeg(
  leg: FlightOptionSummary["slices"][number]["legs"][number],
): string {
  const departure = formatDateTime(leg.departureDateTime, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
  const arrival = formatDateTime(leg.arrivalDateTime, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });

  return `<tr>
    <td style="padding:4px 0; font-size:13px; color:#0f172a;">
      <strong>${escapeHtml(leg.departureAirportCode)}</strong>
      <div style="color:#64748b">${escapeHtml(departure)}</div>
    </td>
    <td style="padding:4px 0; text-align:center; font-size:12px; color:#94a3b8;">→</td>
    <td style="padding:4px 0; font-size:13px; color:#0f172a; text-align:right;">
      <strong>${escapeHtml(leg.arrivalAirportCode)}</strong>
      <div style="color:#64748b">${escapeHtml(arrival)}</div>
    </td>
  </tr>
  <tr>
    <td colspan="3" style="padding:2px 0 10px; font-size:12px; color:#64748b;">
      ${escapeHtml(leg.airlineName)} • ${escapeHtml(leg.airlineCode)} ${escapeHtml(leg.flightNumber)}
    </td>
  </tr>`;
}

function renderSlice(
  slice: FlightOptionSummary["slices"][number],
  sliceIndex: number,
  totalSlices: number,
): string {
  const stopsLabel =
    slice.stops === 0
      ? "Nonstop"
      : `${slice.stops} stop${slice.stops > 1 ? "s" : ""}`;
  const durationLabel = formatDuration(slice.durationMinutes);

  return `<div style="margin-top:16px;">
    ${totalSlices > 1 ? `<div style="font-size:12px; text-transform:uppercase; color:#64748b; letter-spacing:0.04em; margin-bottom:6px;">Segment ${sliceIndex + 1}</div>` : ""}
    <div style="font-size:12px; color:#475569;">${escapeHtml(stopsLabel)} • ${escapeHtml(durationLabel)}</div>
    <table role="presentation" width="100%" style="margin-top:12px; border-collapse:collapse;">
      <tbody>
        ${slice.legs.map((leg) => renderLeg(leg)).join("")}
      </tbody>
    </table>
  </div>`;
}

export function renderFlightOptionsList(
  options: FlightOptionSummary[],
): string {
  if (options.length === 0) {
    return `<div style="padding:20px; border:1px dashed #cbd5f5; border-radius:10px; color:#64748b; font-size:14px; text-align:center;">No matching flights were found.</div>`;
  }

  return options
    .map((option, index) => {
      const formattedPrice = formatCurrency(option.totalPrice, option.currency);
      const totalStops = option.slices.reduce(
        (sum, slice) => sum + slice.stops,
        0,
      );
      const summaryLabel =
        option.slices.length > 1
          ? `${option.slices.length} segments`
          : totalStops === 0
            ? "Nonstop"
            : `${totalStops} stop${totalStops > 1 ? "s" : ""}`;

      return `<div style="border:1px solid #e2e8f0; border-radius:12px; padding:20px; margin-top:${index === 0 ? 0 : 16}px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
          <div>
            <div style="font-weight:600; font-size:15px; color:#0f172a;">Option ${index + 1} • ${escapeHtml(formattedPrice)}</div>
            <div style="font-size:13px; color:#64748b;">${escapeHtml(summaryLabel)}</div>
          </div>
          <div style="font-size:12px; color:#4338ca; background:#eef2ff; padding:4px 10px; border-radius:9999px;">${escapeHtml(option.currency)}</div>
        </div>
        ${option.slices.map((slice, sliceIndex) => renderSlice(slice, sliceIndex, option.slices.length)).join("")}
      </div>`;
    })
    .join("");
}
