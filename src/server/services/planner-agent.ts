import { generateText } from "ai";
import { z } from "zod";
import { DEFAULT_MODEL, GROQ_CONFIG } from "@/lib/groq/client";
import { Currency, MaxStops, SeatType, TripType } from "@/lib/fli/models";
import { logger } from "@/lib/logger";
import type {
  PlanItineraryInput,
  PlanItineraryOutput,
} from "../schemas/planner";
import { searchAirports } from "./airports";
import { searchCalendarPrices, searchFlights } from "./flights";
import type { FlightOption } from "./flights";

/**
 * AI-powered flight planner agent using Vercel AI SDK
 * Uses tool calling with generateText (returns JSON, not RSCs)
 */

/**
 * Tool definitions for the planner agent
 */
const tools = {
  searchAirport: {
    description:
      "Search for airports by name, city, country, or IATA/ICAO code. Returns airport details including coordinates.",
    parameters: z.object({
      query: z
        .string()
        .describe("Search query (airport name, city, or airport code)"),
      limit: z
        .number()
        .int()
        .positive()
        .max(20)
        .default(10)
        .describe("Maximum number of results"),
    }),
    execute: async ({ query, limit }: { query: string; limit?: number }) => {
      logger.info("Agent tool: searchAirport", { query, limit });
      const result = searchAirports({ query, limit });
      return {
        airports: result.airports.slice(0, 5).map((a) => ({
          name: a.name,
          city: a.city,
          country: a.country,
          iata: a.iata,
          coordinates: { lat: a.latitude, lon: a.longitude },
        })),
        total: result.total,
      };
    },
  },

  searchFlightPrices: {
    description:
      "Search for flight prices across a date range. Returns calendar of prices for the specified route.",
    parameters: z.object({
      origin: z
        .string()
        .length(3)
        .describe("Origin airport IATA code (3 letters)"),
      destination: z
        .string()
        .length(3)
        .describe("Destination airport IATA code (3 letters)"),
      dateFrom: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe("Start date in YYYY-MM-DD format"),
      dateTo: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe("End date in YYYY-MM-DD format"),
      maxPrice: z
        .number()
        .positive()
        .optional()
        .describe("Maximum price filter in USD"),
    }),
    execute: async ({
      origin,
      destination,
      dateFrom,
      dateTo,
      maxPrice,
    }: {
      origin: string;
      destination: string;
      dateFrom: string;
      dateTo: string;
      maxPrice?: number;
    }) => {
      logger.info("Agent tool: searchFlightPrices", {
        origin,
        destination,
        dateFrom,
        dateTo,
        maxPrice,
      });

      try {
        const result = await searchCalendarPrices({
          tripType: TripType.ONE_WAY,
          segments: [{ origin, destination, departureDate: dateFrom }],
          dateRange: { from: dateFrom, to: dateTo },
          passengers: {
            adults: 1,
            children: 0,
            infantsInSeat: 0,
            infantsOnLap: 0,
          },
          seatType: SeatType.ECONOMY,
          stops: MaxStops.ANY,
          ...(maxPrice
            ? { priceLimit: { amount: maxPrice, currency: Currency.USD } }
            : {}),
        });

        // Return top 10 cheapest dates
        const sorted = [...result.prices].sort((a, b) => a.price - b.price);
        return {
          currency: result.currency,
          prices: sorted.slice(0, 10),
          cheapest: sorted[0],
        };
      } catch (error) {
        logger.error("Error in searchFlightPrices tool", { error });
        return { error: "Failed to search flight prices" };
      }
    },
  },

  searchFlightDetails: {
    description:
      "Get detailed flight options for a specific date and route. Returns up to 5 flight options with full details.",
    parameters: z.object({
      origin: z.string().length(3).describe("Origin airport IATA code"),
      destination: z
        .string()
        .length(3)
        .describe("Destination airport IATA code"),
      departureDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe("Departure date in YYYY-MM-DD format"),
    }),
    execute: async ({
      origin,
      destination,
      departureDate,
    }: {
      origin: string;
      destination: string;
      departureDate: string;
    }) => {
      logger.info("Agent tool: searchFlightDetails", {
        origin,
        destination,
        departureDate,
      });

      try {
        const result = await searchFlights({
          tripType: TripType.ONE_WAY,
          segments: [{ origin, destination, departureDate }],
          dateRange: { from: departureDate, to: departureDate },
          passengers: {
            adults: 1,
            children: 0,
            infantsInSeat: 0,
            infantsOnLap: 0,
          },
          seatType: SeatType.ECONOMY,
          stops: MaxStops.ANY,
        });

        // Return top 5 options
        return {
          flights: result.slice(0, 5).map((f) => ({
            price: f.totalPrice,
            currency: f.currency,
            stops: Math.max(...f.slices.map((s) => s.stops)),
            duration: f.slices.reduce((sum, s) => sum + s.durationMinutes, 0),
            airlines: [
              ...new Set(
                f.slices.flatMap((s) => s.legs.map((l) => l.airlineCode)),
              ),
            ],
          })),
        };
      } catch (error) {
        logger.error("Error in searchFlightDetails tool", { error });
        return { error: "Failed to search flight details" };
      }
    },
  },

  getPopularRoutes: {
    description:
      "Get popular flight routes for inspiration. Useful when user asks for recommendations or doesn't specify destination.",
    parameters: z.object({
      from: z
        .string()
        .length(3)
        .optional()
        .describe("Optional origin airport to filter routes"),
    }),
    execute: async ({ from }: { from?: string }) => {
      logger.info("Agent tool: getPopularRoutes", { from });

      // Popular routes (can be expanded)
      const popularRoutes = [
        { from: "JFK", to: "LAX", route: "New York to Los Angeles" },
        { from: "LHR", to: "JFK", route: "London to New York" },
        { from: "SFO", to: "NRT", route: "San Francisco to Tokyo" },
        { from: "LAX", to: "HNL", route: "Los Angeles to Honolulu" },
        { from: "ORD", to: "LAX", route: "Chicago to Los Angeles" },
        { from: "ATL", to: "LAX", route: "Atlanta to Los Angeles" },
        { from: "JFK", to: "LHR", route: "New York to London" },
        { from: "LAX", to: "CDG", route: "Los Angeles to Paris" },
      ];

      const filtered = from
        ? popularRoutes.filter((r) => r.from === from.toUpperCase())
        : popularRoutes;

      return { routes: filtered.slice(0, 5) };
    },
  },
};

/**
 * System prompt for the planner agent
 */
const SYSTEM_PROMPT = `You are an expert flight planning assistant. Your goal is to help users find the best flight options based on their preferences.

CAPABILITIES:
- Search for airports by name or code
- Find flight prices across date ranges
- Get detailed flight options for specific dates
- Suggest popular routes for inspiration

GUIDELINES:
1. Always clarify ambiguous requests (e.g., ask for specific dates if not provided)
2. Use searchAirport first if airport codes are not clear
3. Use searchFlightPrices to get an overview of prices across dates
4. Use searchFlightDetails to get specific flight options for the best dates
5. Prioritize budget constraints when provided
6. Provide 1-3 concrete recommendations with reasoning
7. Be concise but informative

CONSTRAINTS:
- Price-first experience (ignore award points)
- Focus on economy class unless specified
- Search is limited to Google Flights data
- Maximum 3 recommendations

When you have enough information, provide your final recommendations with clear reasoning about why each option is suitable.`;

/**
 * Main planner agent function using AI SDK with tool calling
 * Returns structured JSON data (not RSCs) for TRPC compatibility
 */
export async function planItinerary(
  input: PlanItineraryInput,
): Promise<PlanItineraryOutput> {
  const startTime = Date.now();

  logger.info("Planning itinerary", {
    prompt: input.prompt,
    filters: input.filters,
  });

  const transcript: PlanItineraryOutput["transcript"] = [];
  let flightResults: FlightOption[] = [];

  try {
    const result = await generateText({
      model: DEFAULT_MODEL,
      system: SYSTEM_PROMPT,
      prompt: input.prompt,
      temperature: GROQ_CONFIG.temperature,
      maxTokens: GROQ_CONFIG.maxTokens,
      tools,
      maxToolRoundtrips: 5,
      onStepFinish: ({ toolCalls, toolResults }) => {
        // Log tool execution for transparency
        if (toolCalls && toolResults) {
          for (let i = 0; i < toolCalls.length; i++) {
            const call = toolCalls[i];
            const resultItem = toolResults[i];
            transcript.push({
              step: transcript.length + 1,
              tool: call?.toolName || "unknown",
              input: call?.args as Record<string, unknown>,
              output: resultItem?.result,
              timestamp: new Date().toISOString(),
            });
          }
        }
      },
    });

    // Extract flight results from transcript if available
    const flightDetailsSteps = transcript.filter(
      (step) => step.tool === "searchFlightDetails",
    );
    if (flightDetailsSteps.length > 0) {
      const lastFlightStep = flightDetailsSteps[flightDetailsSteps.length - 1];
      const output = lastFlightStep.output as { flights?: FlightOption[] };
      if (output?.flights) {
        flightResults = output.flights;
      }
    }

    const executionTimeMs = Date.now() - startTime;

    logger.info("Itinerary planned successfully", {
      executionTimeMs,
      toolCalls: transcript.length,
    });

    // Convert flights to simplified format
    const recommendations = flightResults.slice(0, 3).map((flight) => ({
      origin: flight.slices[0]?.legs[0]?.departureAirportCode || "Unknown",
      destination:
        flight.slices[0]?.legs[flight.slices[0].legs.length - 1]
          ?.arrivalAirportCode || "Unknown",
      departureDate:
        flight.slices[0]?.legs[0]?.departureDateTime.split("T")[0] ||
        new Date().toISOString().split("T")[0],
      returnDate:
        flight.slices.length > 1
          ? flight.slices[1]?.legs[0]?.departureDateTime.split("T")[0]
          : null,
      price: flight.totalPrice,
      currency: flight.currency,
      stops: Math.max(...flight.slices.map((s) => s.stops)),
      duration: flight.slices.reduce((sum, s) => sum + s.durationMinutes, 0),
      airlines: [
        ...new Set(
          flight.slices.flatMap((s) => s.legs.map((l) => l.airlineCode)),
        ),
      ],
    }));

    return {
      transcript,
      recommendations,
      summary: result.text,
      confidence: transcript.length > 0 ? 0.8 : 0.5,
      notes: [],
      executionTimeMs,
    };
  } catch (error) {
    logger.error("Failed to plan itinerary", { error });
    const executionTimeMs = Date.now() - startTime;

    return {
      transcript,
      recommendations: [],
      summary: `Failed to plan itinerary: ${error instanceof Error ? error.message : "Unknown error"}`,
      confidence: 0,
      notes: ["An error occurred during planning. Please try again."],
      executionTimeMs,
    };
  }
}
