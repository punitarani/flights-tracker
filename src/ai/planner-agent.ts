import {
  Experimental_Agent as Agent,
  type InferUITools,
  stepCountIs,
  type UIDataTypes,
  type UIMessage,
} from "ai";

import { getSystemPrompt } from "./planner-prompt";
import { controlSceneTool, searchDatesTool, searchFlightsTool } from "./tools";
import type { PlannerContext } from "./types";

const PlannerAgentTools = {
  searchFlights: searchFlightsTool,
  searchDates: searchDatesTool,
  controlScene: controlSceneTool,
};

/**
 * Create a Flight Planner Agent instance with user context.
 *
 * This factory function creates a new agent for each request with
 * personalized system prompt including current date/time, user info,
 * and scene state.
 *
 * Capabilities:
 * - Search for specific flights with detailed filters
 * - Find cheapest dates to fly across date ranges
 * - Control UI scene to show maps or search results
 * - Multi-turn conversations with context awareness
 * - Parallel tool calls for efficient planning
 *
 * Tools:
 * - searchFlights: Find one-way flights for specific dates
 * - searchDates: Find best prices across date ranges
 * - controlScene: Switch between map and search views
 *
 * Configuration:
 * - Max steps: 15 (prevents infinite loops while allowing complex planning)
 * - Auto tool choice: Agent decides when to use tools
 * - Error recovery: Tools return graceful errors for agent to handle
 *
 * @param context - The planner context with user and scene information
 * @returns A configured Agent instance
 */
export function createPlannerAgent(context: PlannerContext) {
  return new Agent({
    model: "openai/gpt-5-mini",
    system: getSystemPrompt(context),
    tools: PlannerAgentTools,
    stopWhen: stepCountIs(25), // Allow multiple tool calls for complex planning
    maxRetries: 3, // Retry on transient failures
  });
}

/**
 * Type-safe UI message for the planner agent.
 * Includes all tool types with proper inference.
 */
export type PlannerAgentUIMessage = UIMessage<
  never,
  UIDataTypes,
  InferUITools<typeof PlannerAgentTools>
>;
