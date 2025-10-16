import Groq from "groq-sdk";
import { env } from "@/env";

/**
 * Server-only Groq client for AI-powered flight planning
 * Uses Llama 3.3 70B on Groq's hardware for fast inference
 */

let groqInstance: Groq | null = null;

export function getGroqClient(): Groq {
  if (!groqInstance) {
    groqInstance = new Groq({
      apiKey: env.GROQ_API_KEY,
    });
  }
  return groqInstance;
}

/**
 * Default model for planner agent
 * Llama 3.3 70B Versatile provides excellent reasoning at ~0.2s latency
 */
export const DEFAULT_MODEL = "llama-3.3-70b-versatile";

/**
 * Groq configuration for planner agent
 */
export const GROQ_CONFIG = {
  model: DEFAULT_MODEL,
  temperature: 0.7, // Balanced creativity and consistency
  maxTokens: 2000, // Sufficient for itinerary recommendations
  topP: 0.9,
} as const;
