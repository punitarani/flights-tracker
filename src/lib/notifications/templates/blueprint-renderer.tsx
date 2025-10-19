import type { ReactNode } from "react";

import type { EmailBlueprint } from "../ai-email-schemas";
import { wrapWithLayout } from "./blueprint-utils";
import {
  BadgeRow,
  ChartBlock,
  EmailSection,
  FlightCardGrid,
  TextBlock,
} from "./components";

type BlueprintRenderOptions = {
  blueprint: EmailBlueprint;
  fallbackSubject: string;
  fallbackPreview: string;
  hero?: ReactNode;
};

export function renderEmailFromBlueprint({
  blueprint,
  fallbackSubject,
  fallbackPreview,
  hero,
}: BlueprintRenderOptions) {
  const subject = blueprint.metadata.subject ?? fallbackSubject;
  const previewText = blueprint.metadata.previewText ?? fallbackPreview;

  const sections = blueprint.sections.map((section) => {
    const components = section.components.map((component, index) => {
      switch (component.type) {
        case "text":
          return (
            <TextBlock
              key={`${section.id}-text-${index}`}
              headline={component.headline}
              body={component.body}
            />
          );
        case "badge-row":
          return (
            <BadgeRow
              key={`${section.id}-badges-${index}`}
              items={component.items}
            />
          );
        case "chart":
          return (
            <ChartBlock
              key={`${section.id}-chart-${index}`}
              title={component.title}
              summary={component.summary}
              unit={component.unit}
              chartType={component.chartType}
              data={component.data}
            />
          );
        case "flight-card":
          return (
            <FlightCardGrid
              key={`${section.id}-flights-${index}`}
              cards={[
                {
                  title: component.title,
                  description: component.description,
                  highlights: component.highlights,
                  action: component.action,
                },
              ]}
            />
          );
        default: {
          const _exhaustive: never = component;
          throw new Error(`Unknown component type: ${_exhaustive}`);
        }
      }
    });

    return (
      <EmailSection
        key={section.id}
        title={section.title}
        description={section.description}
      >
        {components}
      </EmailSection>
    );
  });

  const intro = blueprint.metadata.intro ? (
    <EmailSection key="intro">
      <TextBlock body={blueprint.metadata.intro} />
    </EmailSection>
  ) : null;

  const personalization = blueprint.metadata.personalization ? (
    <EmailSection key="personalization">
      <TextBlock body={blueprint.metadata.personalization} />
    </EmailSection>
  ) : null;

  const callToAction = blueprint.metadata.callToAction ? (
    <EmailSection key="cta">
      <TextBlock body={blueprint.metadata.callToAction.label} />
    </EmailSection>
  ) : null;

  const html = wrapWithLayout(
    previewText,
    <>
      {hero}
      {intro}
      {sections}
      {callToAction}
      {personalization}
    </>,
  );

  return { subject, html };
}
