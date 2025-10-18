import { tool } from "ai";
import { z } from "zod";
import { Currency, MaxStops, SeatType, TripType } from "@/lib/fli/models";
import { logger } from "@/lib/logger";
import { calculateDistance, getAirportByIataDB } from "../services/airports-db";
import { searchCalendarPrices, searchFlights } from "../services/flights";

/**
 * Vercel AI SDK Tool Definitions for Flight Planner
 *
 * These tools enable the LLM to:
 * 1. Analyze routes and validate they're not same-city
 * 2. Search calendar prices to find best dates
 * 3. Get detailed flight options
 *
 * The LLM autonomously:
 * - Determines airport codes from user input (no tool needed!)
 * - Decides which tools to call and in what order
 * - Provides helpful insights and recommendations
 */

/**
 * Tool: Search Calendar Prices
 * Gets flight prices across multiple dates for a route
 */
export const searchCalendarPricesTool = tool({
  description: `Get flight prices across a date range for a specific route.
Returns an array of dates with the lowest price for each date.

Use this to:
- Find the cheapest days to fly
- See price trends over time
- Identify the best dates within a range

Note: Always search airports first to get valid IATA codes.`,

  inputSchema: z.object({
    origin: z
      .string()
      .length(3)
      .describe("Origin airport IATA code in UPPERCASE (3 letters, e.g., SFO)"),
    destination: z
      .string()
      .length(3)
      .describe(
        "Destination airport IATA code in UPPERCASE (3 letters, e.g., LAX)",
      ),
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
      .describe("Optional maximum price filter in USD"),
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
    const originUpper = origin.toUpperCase();
    const destUpper = destination.toUpperCase();

    logger.info("💰 searchCalendarPrices tool called", {
      origin: originUpper,
      destination: destUpper,
      dateFrom,
      dateTo,
      maxPrice,
    });

    console.log("💰 searchCalendarPrices executing", {
      origin: originUpper,
      destination: destUpper,
      dateFrom,
      dateTo,
    });

    try {
      const result = await searchCalendarPrices({
        tripType: TripType.ONE_WAY,
        segments: [
          {
            origin: originUpper,
            destination: destUpper,
            departureDate: dateFrom,
          },
        ],
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
          ? {
              priceLimit: {
                amount: maxPrice,
                currency: Currency.USD,
              },
            }
          : {}),
      });

      const prices = result.prices
        .filter((p) => (maxPrice ? p.price <= maxPrice : true))
        .sort((a, b) => a.price - b.price);

      logger.info("✅ searchCalendarPrices tool result", {
        origin: originUpper,
        destination: destUpper,
        priceCount: prices.length,
        cheapest: prices[0],
      });

      console.log("✅ searchCalendarPrices success", {
        route: `${originUpper} → ${destUpper}`,
        priceCount: prices.length,
        cheapest: prices[0],
      });

      return {
        route: `${originUpper} → ${destUpper}`,
        prices: prices.map((p) => ({
          date: p.date,
          price: p.price,
        })),
        priceCount: prices.length,
        cheapestPrice: prices[0]?.price,
        cheapestDate: prices[0]?.date,
        averagePrice:
          prices.length > 0
            ? Math.round(
                prices.reduce((sum, p) => sum + p.price, 0) / prices.length,
              )
            : 0,
      };
    } catch (error) {
      console.error("❌ searchCalendarPrices error:", error);
      logger.error("❌ searchCalendarPrices tool error", {
        error,
        origin: originUpper,
        destination: destUpper,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      // Return error instead of throwing - allows conversation to continue
      return {
        route: `${originUpper} → ${destUpper}`,
        error: error instanceof Error ? error.message : "Unknown error",
        prices: [],
        priceCount: 0,
        cheapestPrice: 0,
        cheapestDate: null,
        averagePrice: 0,
      };
    }
  },
});

/**
 * Tool: Search Flight Details
 * Gets detailed flight options for a specific date
 */
export const searchFlightDetailsTool = tool({
  description: `Get detailed flight options for a specific date.
Returns actual flights with airlines, times, stops, and prices.

Use this after finding the best dates with calendar search.`,

  inputSchema: z.object({
    origin: z
      .string()
      .length(3)
      .toUpperCase()
      .describe("Origin airport IATA code"),
    destination: z
      .string()
      .length(3)
      .toUpperCase()
      .describe("Destination airport IATA code"),
    departureDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .describe("Departure date in YYYY-MM-DD format"),
    maxPrice: z
      .number()
      .positive()
      .optional()
      .describe("Optional maximum price filter in USD"),
    maxStops: z
      .enum(["0", "1", "any"])
      .optional()
      .describe("Maximum number of stops (0 = nonstop)"),
  }),

  execute: async ({
    origin,
    destination,
    departureDate,
    maxPrice,
    maxStops,
  }: {
    origin: string;
    destination: string;
    departureDate: string;
    maxPrice?: number;
    maxStops?: "0" | "1" | "any";
  }) => {
    const originUpper = origin.toUpperCase();
    const destUpper = destination.toUpperCase();

    logger.info("✈️ searchFlightDetails tool called", {
      origin: originUpper,
      destination: destUpper,
      departureDate,
      maxPrice,
      maxStops,
    });

    console.log("✈️ searchFlightDetails executing", {
      origin: originUpper,
      destination: destUpper,
      departureDate,
    });

    try {
      const flights = await searchFlights({
        tripType: TripType.ONE_WAY,
        segments: [
          { origin: originUpper, destination: destUpper, departureDate },
        ],
        dateRange: { from: departureDate, to: departureDate },
        passengers: {
          adults: 1,
          children: 0,
          infantsInSeat: 0,
          infantsOnLap: 0,
        },
        seatType: SeatType.ECONOMY,
        stops:
          maxStops === "0"
            ? MaxStops.NON_STOP
            : maxStops === "1"
              ? MaxStops.ONE_STOP_OR_FEWER
              : MaxStops.ANY,
        ...(maxPrice
          ? {
              priceLimit: {
                amount: maxPrice,
                currency: Currency.USD,
              },
            }
          : {}),
      });

      const filteredFlights = flights
        .filter((f) => (maxPrice ? f.totalPrice <= maxPrice : true))
        .slice(0, 10); // Limit to top 10 flights

      logger.info("✅ searchFlightDetails tool result", {
        origin: originUpper,
        destination: destUpper,
        date: departureDate,
        flightCount: filteredFlights.length,
      });

      console.log("✅ searchFlightDetails success", {
        route: `${originUpper} → ${destUpper}`,
        flightCount: filteredFlights.length,
      });

      return {
        route: `${originUpper} → ${destUpper}`,
        date: departureDate,
        flightCount: filteredFlights.length,
        flights: filteredFlights.map((f) => {
          const firstSlice = f.slices[0];
          const firstLeg = firstSlice?.legs[0];
          const lastLeg = firstSlice?.legs[firstSlice.legs.length - 1];

          return {
            price: f.totalPrice,
            currency: f.currency,
            origin: firstLeg?.departureAirportCode || origin,
            destination: lastLeg?.arrivalAirportCode || destination,
            departureTime: firstLeg?.departureDateTime
              .split("T")[1]
              ?.slice(0, 5),
            arrivalTime: lastLeg?.arrivalDateTime.split("T")[1]?.slice(0, 5),
            duration: firstSlice?.durationMinutes || 0,
            stops: firstSlice?.stops || 0,
            airlines: [
              ...new Set(
                f.slices.flatMap((s) => s.legs.map((l) => l.airlineCode)),
              ),
            ],
          };
        }),
        cheapestPrice: filteredFlights[0]?.totalPrice,
      };
    } catch (error) {
      console.error("❌ searchFlightDetails error:", error);
      logger.error("❌ searchFlightDetails tool error", {
        error,
        origin: originUpper,
        destination: destUpper,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      // Return error instead of throwing - allows conversation to continue
      return {
        route: `${originUpper} → ${destUpper}`,
        date: departureDate,
        error: error instanceof Error ? error.message : "Unknown error",
        flightCount: 0,
        flights: [],
        cheapestPrice: 0,
      };
    }
  },
});

/**
 * Tool: Analyze Route
 * Provides route analysis including distance and insights
 */
export const analyzeRouteTool = tool({
  description: `Analyze a flight route to get distance and route information.

Use this to:
- Calculate distance between airports
- Verify route exists
- Get route context for recommendations`,

  inputSchema: z.object({
    origin: z
      .string()
      .length(3)
      .describe("Origin airport IATA code in UPPERCASE (e.g., SFO)"),
    destination: z
      .string()
      .length(3)
      .describe("Destination airport IATA code in UPPERCASE (e.g., LAX)"),
  }),

  execute: async ({
    origin,
    destination,
  }: {
    origin: string;
    destination: string;
  }) => {
    // Uppercase in the execute function, not in schema
    const originUpper = origin.toUpperCase();
    const destUpper = destination.toUpperCase();
    logger.info("analyzeRoute tool called", {
      origin: originUpper,
      destination: destUpper,
    });

    const [originAirport, destAirport] = await Promise.all([
      getAirportByIataDB(originUpper),
      getAirportByIataDB(destUpper),
    ]);

    if (!originAirport || !destAirport) {
      const notFound = !originAirport ? originUpper : destUpper;
      logger.warn("Airport not found in database", { code: notFound });

      // Return error instead of throwing - allows conversation to continue
      return {
        route: `${originUpper} → ${destUpper}`,
        error: `Airport not found: ${notFound}`,
        origin: null,
        destination: null,
        distanceMiles: 0,
        sameCity: false,
        recommendation: `Could not find airport ${notFound} in database. Please verify the airport code.`,
      };
    }

    const distance = calculateDistance(
      originAirport.latitude,
      originAirport.longitude,
      destAirport.latitude,
      destAirport.longitude,
    );

    // Check if same city
    const sameCity =
      originAirport.city.toLowerCase() === destAirport.city.toLowerCase();

    logger.info("analyzeRoute tool result", {
      origin: originUpper,
      destination: destUpper,
      distance,
      sameCity,
    });

    return {
      route: `${originUpper} → ${destUpper}`,
      origin: {
        code: originAirport.iata,
        name: originAirport.name,
        city: originAirport.city,
        country: originAirport.country,
        latitude: originAirport.latitude,
        longitude: originAirport.longitude,
      },
      destination: {
        code: destAirport.iata,
        name: destAirport.name,
        city: destAirport.city,
        country: destAirport.country,
        latitude: destAirport.latitude,
        longitude: destAirport.longitude,
      },
      distanceMiles: Math.round(distance),
      sameCity,
      recommendation: sameCity
        ? "This route is within the same city. Commercial flights are not typically available between airports in the same city."
        : distance < 250
          ? "This is a short-haul domestic route. Consider ground transportation as an alternative."
          : distance < 1500
            ? "This is a domestic or short international route with frequent service."
            : "This is a long-haul international route. Consider searching across multiple dates for best prices.",
    };
  },
});

/**
 * Export all tools as a single object for Vercel AI SDK
 */
export const tools = {
  searchCalendarPrices: searchCalendarPricesTool,
  searchFlightDetails: searchFlightDetailsTool,
  analyzeRoute: analyzeRouteTool,
};
