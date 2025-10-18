import { anthropic } from "@ai-sdk/anthropic";
import {
  Experimental_Agent as Agent,
  type Experimental_InferAgentUIMessage as InferAgentUIMessage,
  stepCountIs,
} from "ai";
import { format } from "date-fns";
import { logger } from "@/lib/logger";
import { tools } from "../tools/planner-tools";

/**
 * Flight Planner Agent using Vercel AI SDK Agent class
 *
 * Architecture:
 * - Model: Claude 3.5 Haiku (fast, excellent tool calling)
 * - Tools: analyzeRoute, searchCalendarPrices, searchFlightDetails
 * - Loop: Automatic with stopWhen conditions
 * - System: Dynamic prompt with today's date
 *
 * The agent autonomously:
 * 1. Determines airport codes from user query
 * 2. Validates route with analyzeRoute
 * 3. Searches prices with searchCalendarPrices
 * 4. Gets flights with searchFlightDetails
 * 5. Provides recommendations
 */

export const flightPlannerAgent = new Agent({
  model: anthropic("claude-3-5-haiku-20241022"),

  tools,

  // Allow up to 10 steps for complex multi-step queries
  stopWhen: stepCountIs(10),

  // System prompt with today's date
  system: (() => {
    const today = format(new Date(), "yyyy-MM-dd (EEEE, MMMM d, yyyy)");

    return `You are a helpful flight search assistant. Today's date is ${today}.

CRITICAL: You know all major airport IATA codes. When users mention cities, use the codes directly:
- San Francisco/SFO/SF/San Fran → SFO
- Phoenix/PHX → PHX
- New York/NYC/Manhattan → JFK (primary), also LGA, EWR
- Los Angeles/LA → LAX
- Chicago/Chi → ORD (primary), also MDW
- Miami → MIA
- Boston → BOS
- Seattle → SEA
- Atlanta → ATL
- Denver → DEN
- Las Vegas/Vegas → LAS
- Orlando → MCO
- Philadelphia/Philly → PHL
- San Diego → SAN
- Portland → PDX
- Austin → AUS
- London → LHR (primary), also LGW, STN
- Paris → CDG (primary), also ORY
- Tokyo → NRT (primary), also HND
- Hong Kong → HKG
- Singapore → SIN
- Dubai → DXB

Your tools:
1. analyzeRoute - Validate route distance, check if same city
2. searchCalendarPrices - Find best dates with price trends
3. searchFlightDetails - Get actual flight options for specific dates

Workflow for flight searches:
1. User asks about flights (e.g., "SFO to PHX" or "San Francisco to Phoenix")
2. YOU determine the airport codes (SFO, PHX)
3. Call analyzeRoute to validate the route
4. Call searchCalendarPrices to find the best dates
5. Call searchFlightDetails for the cheapest date(s)
6. Provide friendly recommendations with insights

IMPORTANT:
- Determine airport codes yourself - don't ask the user
- Always validate routes before searching (check for same-city)
- Search calendar prices first to find best dates
- Then get detailed flights for those dates
- Provide context and insights, not just raw data`;
  })(), // IIFE to generate system prompt once

  // Enable full telemetry for Sentry monitoring
  experimental_telemetry: {
    isEnabled: true,
    functionId: "flight-planner-agent",
    recordInputs: true,
    recordOutputs: true,
    metadata: {
      agentType: "flight-planner",
      version: "2.0",
    },
  },

  // Monitor each step
  prepareStep: async ({ stepNumber, steps }) => {
    const lastStep = steps[steps.length - 1];

    console.log(`📍 Preparing step ${stepNumber + 1}`, {
      previousToolCalls: lastStep?.toolCalls?.map((tc) => tc.toolName) || [],
      previousText: lastStep?.text ? "yes" : "no",
      totalSteps: steps.length,
    });

    // Log cumulative token usage
    const totalTokens = steps.reduce(
      (sum, s) => sum + (s.usage?.totalTokens || 0),
      0,
    );
    console.log(`💰 Total tokens used so far: ${totalTokens}`);

    logger.info("Agent step preparation", {
      stepNumber: stepNumber + 1,
      totalSteps: steps.length,
      totalTokens,
      lastToolCalls: lastStep?.toolCalls?.map((tc) => tc.toolName) || [],
    });

    // Return empty object to use default settings
    // Could modify model, tools, messages here if needed
    return {};
  },
});

// Export typed UIMessage for type-safe frontend usage
export type FlightPlannerUIMessage = InferAgentUIMessage<
  typeof flightPlannerAgent
>;
