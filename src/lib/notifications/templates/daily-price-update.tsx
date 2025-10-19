import type { EmailBlueprint } from "../ai-email-schemas";
import {
  escapeHtml,
  formatCurrency,
  formatDate,
  formatDateTime,
  joinWithAnd,
} from "../formatters";
import type { DailyPriceUpdateEmail } from "../types";
import { type RenderedEmail, renderEmail } from "./base";
import {
  renderCallToActionBlock,
  renderSectionsFromBlueprint,
  wrapWithLayout,
} from "./blueprint-utils";
import {
  BadgeRow,
  buildFlightHighlights,
  EmailSection,
  FlightCardGrid,
  TextBlock,
} from "./components";

function renderBadge(label: string): string {
  return `<span class="badge">${escapeHtml(label)}</span>`;
}

function _renderFilters(
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

type BlueprintOptions = {
  blueprint?: EmailBlueprint;
};

function renderFallbackSections(payload: DailyPriceUpdateEmail) {
  if (payload.alerts.length === 0) {
    return (
      <EmailSection>
        <TextBlock body="No new flight matches were found in the past day." />
      </EmailSection>
    );
  }

  return payload.alerts.map((summary, index) => {
    const generated = formatDateTime(summary.generatedAt, {
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });

    return (
      <EmailSection
        key={summary.alert.id ?? `alert-${index}`}
        title={summary.alert.label}
        description={`${summary.alert.origin} → ${summary.alert.destination} • Updated ${generated}`}
      >
        <BadgeRow
          items={
            [
              summary.alert.seatType ? { label: summary.alert.seatType } : null,
              summary.alert.stops ? { label: summary.alert.stops } : null,
              summary.alert.airlines && summary.alert.airlines.length > 0
                ? { label: `Airlines: ${joinWithAnd(summary.alert.airlines)}` }
                : null,
              summary.alert.priceLimit
                ? {
                    label: `Max ${formatCurrency(
                      summary.alert.priceLimit.amount,
                      summary.alert.priceLimit.currency,
                    )}`,
                  }
                : null,
            ].filter(Boolean) as Array<{ label: string }>
          }
        />
        <FlightCardGrid
          cards={summary.flights.map((flight, idx) => ({
            title: `Option ${idx + 1}`,
            description: `${summary.alert.origin} → ${summary.alert.destination}`,
            highlights: buildFlightHighlights(flight),
          }))}
        />
      </EmailSection>
    );
  });
}

function renderBlueprintEmail(
  _payload: DailyPriceUpdateEmail,
  blueprint: EmailBlueprint,
  fallbackSubject: string,
  fallbackPreview: string,
): RenderedEmail {
  const subject = blueprint.metadata.subject ?? fallbackSubject;
  const previewText = blueprint.metadata.previewText ?? fallbackPreview;

  const intro = blueprint.metadata.intro ? (
    <EmailSection>
      <TextBlock body={blueprint.metadata.intro} />
    </EmailSection>
  ) : null;

  const personalization = blueprint.metadata.personalization ? (
    <EmailSection>
      <TextBlock body={blueprint.metadata.personalization} />
    </EmailSection>
  ) : null;

  const callToAction = blueprint.metadata.callToAction
    ? renderCallToActionBlock(blueprint.metadata.callToAction)
    : null;

  const html = wrapWithLayout(
    previewText,
    <>
      {intro}
      {renderSectionsFromBlueprint(blueprint.sections)}
      {callToAction}
      {personalization}
    </>,
  );

  return renderEmail({ subject, html });
}

function renderFallbackEmail(
  payload: DailyPriceUpdateEmail,
  subject: string,
  previewText: string,
): RenderedEmail {
  const sections = renderFallbackSections(payload);

  const html = wrapWithLayout(
    previewText,
    <>
      <EmailSection title="Daily flight price update">
        <TextBlock
          body={`Summary for ${escapeHtml(formatDate(payload.summaryDate))}`}
        />
      </EmailSection>
      {sections}
    </>,
  );

  return renderEmail({ subject, html });
}

export function renderDailyPriceUpdateEmail(
  payload: DailyPriceUpdateEmail,
  options?: BlueprintOptions,
): RenderedEmail {
  const subject = `Daily update: ${formatDate(payload.summaryDate)} alerts`;
  const previewText = payload.alerts.length
    ? `Top matches for ${payload.alerts.length} active alert${payload.alerts.length > 1 ? "s" : ""}.`
    : "No new matches today.";

  if (!options?.blueprint) {
    return renderFallbackEmail(payload, subject, previewText);
  }

  try {
    return renderBlueprintEmail(
      payload,
      options.blueprint,
      subject,
      previewText,
    );
  } catch {
    return renderFallbackEmail(payload, subject, previewText);
  }
}
