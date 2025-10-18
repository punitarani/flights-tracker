import { createGroq } from "@ai-sdk/groq";
import { env } from "@/env";

/**
 * Server-only Groq client using Vercel AI SDK
 * Uses GPT-OSS models on Groq's hardware for structured outputs
 */

export const groq = createGroq({
  apiKey: env.GROQ_API_KEY,
});

/**
 * Default model for planner agent - Structured Data Extraction
 *
 * GPT-OSS-20B supports structured outputs (json_schema) for reliable extraction
 * This is used for extracting flight parameters from natural language
 *
 * Supported structured output models:
 * - openai/gpt-oss-20b (faster, good for extraction) ✅ CURRENT
 * - openai/gpt-oss-120b (more capable, slightly slower)
 * - moonshotai/kimi-k2-instruct (alternative)
 */
export const DEFAULT_MODEL = groq("openai/gpt-oss-20b");

/**
 * Model for generating natural language summaries
 *
 * Llama 3.3 70B Versatile is excellent for text generation
 * This is used for creating friendly summaries of flight results
 * Note: Doesn't support structured output, but that's not needed for summaries
 */
export const SUMMARY_MODEL = groq("llama-3.3-70b-versatile");

/**
 * Groq configuration for planner agent
 */
export const GROQ_CONFIG = {
  temperature: 0.7, // Balanced creativity and consistency
  topP: 0.9,
} as const;
