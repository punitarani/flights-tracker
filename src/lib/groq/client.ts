import { createGroq } from "@ai-sdk/groq";
import { env } from "@/env";

/**
 * Server-only Groq client using Vercel AI SDK
 * Uses Llama 3.3 70B on Groq's hardware for fast inference
 */

export const groq = createGroq({
  apiKey: env.GROQ_API_KEY,
});

/**
 * Default model for planner agent
 * Llama 3.3 70B Versatile provides excellent reasoning at ~0.2s latency
 */
export const DEFAULT_MODEL = groq("llama-3.3-70b-versatile");

/**
 * Groq configuration for planner agent
 */
export const GROQ_CONFIG = {
  temperature: 0.7, // Balanced creativity and consistency
  maxTokens: 2000, // Sufficient for itinerary recommendations
  topP: 0.9,
} as const;
