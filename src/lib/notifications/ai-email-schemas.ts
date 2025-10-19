import { z } from "zod";

export const EmailBlueprintMetadataSchema = z.object({
  subject: z.string().min(1).max(120),
  previewText: z.string().min(1).max(180),
  intro: z.string().min(1).max(600),
  callToAction: z
    .object({
      label: z.string().min(1).max(60),
      url: z.string().url().optional(),
    })
    .optional(),
  personalization: z.string().max(240).optional(),
});

export const TextBlockComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("text"),
  headline: z.string().min(1).max(120).optional(),
  body: z.string().min(1).max(800),
  tone: z
    .enum(["concise", "detailed", "urgent", "celebratory"])
    .default("concise"),
});

export const FlightCardComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("flight-card"),
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(240),
  highlights: z
    .array(
      z.object({
        label: z.string().min(1).max(60),
        value: z.string().min(1).max(120),
      }),
    )
    .min(1)
    .max(6),
  action: z
    .object({
      label: z.string().min(1).max(50),
      url: z.string().url(),
    })
    .optional(),
});

export const ChartComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("chart"),
  title: z.string().min(1).max(120),
  chartType: z.enum(["sparkline", "bar"]),
  unit: z.enum(["usd", "minutes", "percent", "count"]).optional(),
  data: z
    .array(
      z.object({
        label: z.string().min(1).max(40),
        value: z.number().finite(),
      }),
    )
    .min(2)
    .max(20),
  summary: z.string().min(1).max(200),
});

export const BadgeRowComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("badge-row"),
  items: z
    .array(
      z.object({
        label: z.string().min(1).max(40),
      }),
    )
    .min(1)
    .max(10),
});

export const EmailComponentSchema = z.discriminatedUnion("type", [
  TextBlockComponentSchema,
  FlightCardComponentSchema,
  ChartComponentSchema,
  BadgeRowComponentSchema,
]);

export const EmailSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(120).optional(),
  description: z.string().min(1).max(240).optional(),
  components: z.array(EmailComponentSchema).min(1).max(6),
});

export const EmailBlueprintSchema = z.object({
  metadata: EmailBlueprintMetadataSchema,
  sections: z.array(EmailSectionSchema).min(1).max(6),
});

export type EmailBlueprint = z.infer<typeof EmailBlueprintSchema>;
export type EmailSection = z.infer<typeof EmailSectionSchema>;
export type EmailComponent = z.infer<typeof EmailComponentSchema>;
