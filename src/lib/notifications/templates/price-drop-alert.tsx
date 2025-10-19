import type { EmailBlueprint } from "../ai-email-schemas";
import {
  escapeHtml,
  formatCurrency,
  formatDate,
  formatDateTime,
  joinWithAnd,
} from "../formatters";
import type { PriceDropAlertEmail } from "../types";
import { type RenderedEmail, renderEmail } from "./base";
import {
  renderCallToActionBlock,
  renderSectionsFromBlueprint,
  wrapWithLayout,
} from "./blueprint-utils";
import {
  buildFlightHighlights,
  EmailSection,
  FlightCardGrid,
  TextBlock,
} from "./components";

type BlueprintOptions = {
  blueprint?: EmailBlueprint;
};

type HeroContent = {
  title: string;
  subtitle: string;
  updated: string;
  badges: string[];
  summary?: string;
};

function buildHeroContent(payload: PriceDropAlertEmail): HeroContent {
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

  return {
    title: `${alert.origin} → ${alert.destination}`,
    subtitle: `Alert: ${alert.label}`,
    updated: `Updated ${detectedLabel}`,
    badges: filters,
    summary: priceSummary || undefined,
  };
}

function renderHero(payload: PriceDropAlertEmail) {
  const hero = buildHeroContent(payload);

  return (
    <section
      style={{
        padding: "32px 28px",
        borderBottom: "1px solid #e2e8f0",
        background: "linear-gradient(135deg, #eef2ff 0%, #fff 100%)",
      }}
    >
      <div
        style={{
          fontSize: "13px",
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        Price drop detected
      </div>
      <h1 style={{ margin: "8px 0 0", fontSize: "22px", color: "#0f172a" }}>
        {hero.title}
      </h1>
      <div style={{ fontSize: "14px", color: "#475569", marginTop: "6px" }}>
        {hero.subtitle}
      </div>
      <div style={{ fontSize: "13px", color: "#64748b", marginTop: "6px" }}>
        {hero.updated}
      </div>
      {hero.badges.length ? (
        <div
          style={{
            marginTop: "10px",
            display: "flex",
            gap: "6px",
            flexWrap: "wrap",
          }}
        >
          {hero.badges.map((label) => (
            <span
              key={label}
              style={{
                display: "inline-block",
                padding: "4px 10px",
                fontSize: "12px",
                borderRadius: "9999px",
                background: "#eef2ff",
                color: "#4338ca",
                letterSpacing: "0.02em",
              }}
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}
      {hero.summary ? (
        <div style={{ fontSize: "14px", color: "#4338ca", marginTop: "12px" }}>
          {hero.summary}
        </div>
      ) : null}
    </section>
  );
}

function renderBlueprintEmail(
  payload: PriceDropAlertEmail,
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

  const sections = renderSectionsFromBlueprint(blueprint.sections);

  const html = wrapWithLayout(
    previewText,
    <>
      {renderHero(payload)}
      {intro}
      {sections}
      {callToAction}
      {personalization}
    </>,
  );

  return renderEmail({ subject, html });
}

function renderFallbackEmail(
  payload: PriceDropAlertEmail,
  subject: string,
  previewText: string,
): RenderedEmail {
  const html = wrapWithLayout(
    previewText,
    <>
      {renderHero(payload)}
      <EmailSection>
        <TextBlock body="Here are the best matches right now. Prices can change quickly, so book soon if any option works for you." />
        <FlightCardGrid
          cards={payload.flights.map((flight, idx) => ({
            title: `Option ${idx + 1}`,
            description: `${payload.alert.origin} → ${payload.alert.destination}`,
            highlights: buildFlightHighlights(flight),
          }))}
        />
      </EmailSection>
    </>,
  );

  return renderEmail({ subject, html });
}

export function renderPriceDropAlertEmail(
  payload: PriceDropAlertEmail,
  options?: BlueprintOptions,
): RenderedEmail {
  const baseSubject = `Price drop: ${payload.alert.origin} → ${payload.alert.destination}`;
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
  const fallbackPreview = previewParts.join(" • ");

  if (!options?.blueprint) {
    return renderFallbackEmail(payload, baseSubject, fallbackPreview);
  }

  try {
    return renderBlueprintEmail(
      payload,
      options.blueprint,
      baseSubject,
      fallbackPreview,
    );
  } catch (_error) {
    return renderFallbackEmail(payload, baseSubject, fallbackPreview);
  }
}
