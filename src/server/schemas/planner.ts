import { z } from "zod";

/**
 * Schema for planner input
 * Validates user prompt and optional structured filters
 */
export const PlanItineraryInputSchema = z.object({
  // User's natural language prompt
  prompt: z.string().min(1, "Prompt is required").max(1000),

  // Optional structured overrides
  filters: z
    .object({
      origin: z.string().length(3).optional(),
      destination: z.string().length(3).optional(),
      dateFrom: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      dateTo: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      maxPrice: z.number().positive().optional(),
    })
    .optional(),
});

export type PlanItineraryInput = z.infer<typeof PlanItineraryInputSchema>;

/**
 * Agent step in the planning process
 */
export const AgentStepSchema = z.object({
  step: z.number().int().positive(),
  tool: z.string(),
  input: z.record(z.string(), z.unknown()),
  output: z.unknown(),
  timestamp: z.string(),
});

export type AgentStep = z.infer<typeof AgentStepSchema>;

/**
 * Flight option returned by planner (simplified)
 */
export const PlannerFlightOptionSchema = z.object({
  origin: z.string(),
  destination: z.string(),
  departureDate: z.string(),
  returnDate: z.string().nullable().optional(),
  price: z.number(),
  currency: z.string(),
  stops: z.number(),
  duration: z.number(), // in minutes
  airlines: z.array(z.string()),
});

export type PlannerFlightOption = z.infer<typeof PlannerFlightOptionSchema>;

/**
 * Planner output schema
 */
export const PlanItineraryOutputSchema = z.object({
  // Agent execution transcript
  transcript: z.array(AgentStepSchema),

  // Recommended flight options (up to 3)
  recommendations: z.array(PlannerFlightOptionSchema).max(3),

  // Agent's reasoning summary
  summary: z.string(),

  // Confidence score (0-1)
  confidence: z.number().min(0).max(1),

  // Additional notes or warnings
  notes: z.array(z.string()).optional(),

  // Total execution time in ms
  executionTimeMs: z.number(),
});

export type PlanItineraryOutput = z.infer<typeof PlanItineraryOutputSchema>;
