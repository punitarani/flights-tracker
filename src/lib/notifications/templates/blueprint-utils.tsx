import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { EmailBlueprint, EmailComponent } from "../ai-email-schemas";
import {
  BadgeRow,
  ChartBlock,
  EmailLayout,
  EmailSection,
  FlightCardGrid,
  TextBlock,
} from "./components";

const DOCTYPE = "<!DOCTYPE html>";

type FlightCardComponent = Extract<EmailComponent, { type: "flight-card" }>;

function renderFlightCardGrid(cards: FlightCardComponent[]) {
  if (cards.length === 0) {
    return null;
  }

  return (
    <FlightCardGrid
      cards={cards.map((card) => ({
        title: card.title,
        description: card.description,
        highlights: card.highlights,
        action: card.action,
      }))}
    />
  );
}

export function renderSectionsFromBlueprint(
  sections: EmailBlueprint["sections"],
): ReactNode[] {
  return sections.map((section) => {
    const children: ReactNode[] = [];
    const pendingCards: FlightCardComponent[] = [];

    const flushCards = () => {
      if (pendingCards.length === 0) return;
      const grid = renderFlightCardGrid([...pendingCards]);
      pendingCards.length = 0;
      if (grid) {
        children.push(grid);
      }
    };

    for (const component of section.components) {
      switch (component.type) {
        case "flight-card": {
          pendingCards.push(component);
          break;
        }
        case "text": {
          flushCards();
          children.push(
            <TextBlock
              key={`${section.id}-text-${children.length}`}
              headline={component.headline}
              body={component.body}
            />,
          );
          break;
        }
        case "badge-row": {
          flushCards();
          children.push(
            <BadgeRow
              key={`${section.id}-badges-${children.length}`}
              items={component.items}
            />,
          );
          break;
        }
        case "chart": {
          flushCards();
          children.push(
            <ChartBlock
              key={`${section.id}-chart-${children.length}`}
              title={component.title}
              summary={component.summary}
              unit={component.unit}
              chartType={component.chartType}
              data={component.data}
            />,
          );
          break;
        }
        default: {
          // Exhaustive check
          const _never: never = component;
          throw new Error(`Unsupported blueprint component: ${_never}`);
        }
      }
    }

    flushCards();

    return (
      <EmailSection
        key={section.id}
        title={section.title}
        description={section.description}
      >
        {children}
      </EmailSection>
    );
  });
}

export function wrapWithLayout(
  previewText: string,
  children: ReactNode,
): string {
  return (
    DOCTYPE +
    renderToStaticMarkup(
      <EmailLayout previewText={previewText}>{children}</EmailLayout>,
    )
  );
}

export function renderCallToActionBlock(
  cta: NonNullable<EmailBlueprint["metadata"]["callToAction"]>,
): ReactNode {
  if (!cta.url) {
    return <TextBlock body={cta.label} />;
  }

  return (
    <div style={{ marginTop: "8px" }}>
      <a
        href={cta.url}
        style={{
          display: "inline-block",
          padding: "10px 16px",
          borderRadius: "8px",
          background: "#4338ca",
          color: "#ffffff",
          textDecoration: "none",
          fontSize: "13px",
          fontWeight: 600,
        }}
      >
        {cta.label}
      </a>
    </div>
  );
}
