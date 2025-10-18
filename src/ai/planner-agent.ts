import { Experimental_Agent as Agent } from "ai";

import { getSystemPrompt } from "./planner-prompt";
import { controlSceneTool, searchDatesTool, searchFlightsTool } from "./tools";

/**
 * Flight Planner Agent
 *
 * An AI agent that helps users plan flights with real-time data access.
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
 */
export const plannerAgent = new Agent({
  model: "openai/gpt-4o",
  system: getSystemPrompt(),
  tools: {
    searchFlights: searchFlightsTool,
    searchDates: searchDatesTool,
    controlScene: controlSceneTool,
  },
});
