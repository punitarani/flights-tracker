import { generateObject } from "ai";

import { type EmailBlueprint, EmailBlueprintSchema } from "./ai-email-schemas";

const MODEL_ID = "anthropic/claude-3-5-sonnet";

const BASE_BLUEPRINT: EmailBlueprint = {
  metadata: {
    subject: "Flight alert",
    previewText: "Latest updates based on your alert",
    intro: "Here is your latest flight update.",
    callToAction: undefined,
    personalization: undefined,
  },
  sections: [
    {
      id: "overview",
      title: "Summary",
      description: "Snapshot of the most important changes.",
      components: [
        {
          id: "overview-text",
          type: "text",
          tone: "concise",
          headline: "New flight insights",
          body: "No major updates were provided.",
        },
      ],
    },
  ],
};

function cloneBlueprint(blueprint: EmailBlueprint): EmailBlueprint {
  return JSON.parse(JSON.stringify(blueprint));
}

async function generateBlueprint(
  type: "price-drop" | "daily-update",
  prompt: string,
  context: Record<string, unknown>,
): Promise<EmailBlueprint> {
  const fallback = cloneBlueprint(BASE_BLUEPRINT);
  const contextJson = JSON.stringify({ type, data: context }, null, 2);
  const baselineJson = JSON.stringify(fallback, null, 2);

  try {
    const result = await generateObject({
      model: MODEL_ID,
      system:
        "You are FlightTrack Mailwright, crafting structured, engaging flight alert emails. Follow the provided email blueprint schema exactly. Keep language professional, concise, and actionable. Avoid markdown—use plain sentences.",
      prompt: `${prompt}\n\nContext JSON:\n${contextJson}\n\nBase blueprint example:\n${baselineJson}\n\nReturn a JSON object that matches the schema.`,
      schema: EmailBlueprintSchema,
      maxRetries: 2,
    });

    const candidate = result.object;
    if (candidate) {
      const validated = EmailBlueprintSchema.safeParse(candidate);
      if (validated.success) {
        return validated.data;
      }
    }
  } catch (_error) {
    // Swallow errors and fall back to the baseline template
  }

  return fallback;
}

export type PriceDropBlueprintContext = {
  alert: Record<string, unknown>;
  flights: unknown[];
  priceDelta?: {
    previous?: number;
    current?: number;
    currency?: string;
  };
  metrics?: Record<string, unknown>;
};

export async function generatePriceDropBlueprint(
  context: PriceDropBlueprintContext,
): Promise<EmailBlueprint> {
  const prompt =
    "Flight alert price drop context provided. Produce a compelling summary highlighting savings, urgency, and best flight options.";
  return await generateBlueprint("price-drop", prompt, context);
}

export type DailyDigestBlueprintContext = {
  date: string;
  alerts: Array<Record<string, unknown>>;
  highlights?: string[];
  aggregateMetrics?: Record<string, unknown>;
};

export async function generateDailyDigestBlueprint(
  context: DailyDigestBlueprintContext,
): Promise<EmailBlueprint> {
  const prompt =
    "Daily flight alert digest context provided. Summarize key findings, highlight notable routes, and include chart-ready insights.";
  return await generateBlueprint("daily-update", prompt, context);
}
