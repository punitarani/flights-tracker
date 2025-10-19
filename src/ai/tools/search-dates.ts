import { tool } from "ai";
import { Airline } from "@/lib/fli/models/airline";
import { Airport } from "@/lib/fli/models/airport";
import {
  Currency,
  MaxStops,
  SeatType,
  TripType,
} from "@/lib/fli/models/google-flights/base";
import { SearchDates } from "@/lib/fli/search";
import { type SearchDatesParams, SearchDatesParamsSchema } from "../types";

/**
 * Convert string codes to Airport enum values.
 */
function toAirportEnum(code: string): Airport {
  const airport = Airport[code as keyof typeof Airport];
  if (!airport) {
    throw new Error(`Invalid airport code: ${code}`);
  }
  return airport;
}

/**
 * Convert string codes to Airline enum values.
 */
function toAirlineEnum(code: string): Airline {
  const airline = Airline[code as keyof typeof Airline];
  if (!airline) {
    throw new Error(`Invalid airline code: ${code}`);
  }
  return airline;
}

/**
 * Convert simplified maxStops to enum.
 */
function toMaxStopsEnum(stops: string): MaxStops {
  switch (stops) {
    case "nonstop":
      return MaxStops.NON_STOP;
    case "1":
      return MaxStops.ONE_STOP_OR_FEWER;
    case "2":
      return MaxStops.TWO_OR_FEWER_STOPS;
    default:
      return MaxStops.ANY;
  }
}

/**
 * Convert simplified seatType to enum.
 */
function toSeatTypeEnum(seat: string): SeatType {
  switch (seat) {
    case "premium":
      return SeatType.PREMIUM_ECONOMY;
    case "business":
      return SeatType.BUSINESS;
    case "first":
      return SeatType.FIRST;
    default:
      return SeatType.ECONOMY;
  }
}

/**
 * Convert simplified tripType to enum.
 */
function toTripTypeEnum(type: string): TripType {
  return type === "roundtrip" ? TripType.ROUND_TRIP : TripType.ONE_WAY;
}

/**
 * Format date to YYYY-MM-DD string.
 */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0] ?? "";
}

/**
 * Search Dates Tool
 *
 * Searches for the cheapest dates to fly within a date range.
 * Perfect for flexible travelers looking for the best deals.
 *
 * IMPORTANT:
 * - Always use 3-letter IATA codes for airports (SFO, JFK, LAX)
 * - Always use 2-letter codes for airlines (UA, AA, DL)
 * - For round trips, must provide tripDuration parameter
 * - Can search up to ~300 days in the future
 */
export const searchDatesTool = tool({
  description: `Search for the cheapest dates to fly within a date range. Returns a calendar of prices for each date.

Key Features:
- Flexible date search: Find best prices across weeks or months
- Multi-airport support: Search from/to multiple airports
- Round trip support: Specify trip duration to find best round-trip dates
- Price calendar: See prices for each date in the range

Use Cases:
- "When's the cheapest time to fly to Hawaii this summer?"
- "Find me the best dates to visit New York in December"
- "What are the cheapest weekend trips from SF to LA?"

Important Notes:
- Always use 3-letter airport codes (SFO, JFK) and 2-letter airline codes (UA, AA)
- For round trips, provide tripDuration (e.g., 7 for a week)
- Date range can be up to ~300 days in the future
- Results show prices for each date, sorted by price`,

  inputSchema: SearchDatesParamsSchema,

  execute: async (params: SearchDatesParams) => {
    try {
      // Validate round trip requirements
      if (params.tripType === "roundtrip" && !params.tripDuration) {
        return {
          success: false,
          message:
            "Round trip searches require a trip duration (e.g., 7 days). Please specify how long you want to stay.",
          dates: [],
        };
      }

      // Validate dates are not in the past
      const startDate = new Date(params.startDate);
      const endDate = new Date(params.endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (endDate < today) {
        return {
          success: false,
          message: `End date ${params.endDate} is in the past. Please provide future dates.`,
          dates: [],
        };
      }

      if (startDate > endDate) {
        return {
          success: false,
          message: `Start date ${params.startDate} is after end date ${params.endDate}. Please provide a valid date range.`,
          dates: [],
        };
      }

      // Validate date range is reasonable (max ~1 year)
      const daysDiff = Math.floor(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysDiff > 365) {
        return {
          success: false,
          message: `Date range is too large (${daysDiff} days). Please search within a 1-year period.`,
          dates: [],
        };
      }

      // Validate airport codes exist
      try {
        for (const code of params.origin) {
          toAirportEnum(code);
        }
        for (const code of params.destination) {
          toAirportEnum(code);
        }
      } catch (error) {
        return {
          success: false,
          message: `Invalid airport code: ${(error as Error).message}. Please use valid 3-letter IATA codes.`,
          dates: [],
        };
      }

      // Validate airline codes if provided
      if (params.airlines) {
        try {
          for (const code of params.airlines) {
            toAirlineEnum(code);
          }
        } catch (error) {
          return {
            success: false,
            message: `Invalid airline code: ${(error as Error).message}. Please use valid 2-letter airline codes.`,
            dates: [],
          };
        }
      }

      const searchDates = new SearchDates();
      const tripType = toTripTypeEnum(params.tripType ?? "oneway");

      // Build flight segments
      const firstTravelDate = params.startDate;
      const segments = [
        {
          departureAirport: params.origin.map((code) => [
            toAirportEnum(code),
            0,
          ]),
          arrivalAirport: params.destination.map((code) => [
            toAirportEnum(code),
            0,
          ]),
          travelDate: firstTravelDate,
        },
      ];

      // Add return segment for round trips
      if (tripType === TripType.ROUND_TRIP) {
        segments.push({
          departureAirport: params.destination.map((code) => [
            toAirportEnum(code),
            0,
          ]),
          arrivalAirport: params.origin.map((code) => [toAirportEnum(code), 0]),
          travelDate: firstTravelDate, // Will be adjusted by API
        });
      }

      // Convert parameters to DateSearchFilters
      const filters = {
        tripType,
        passengerInfo: {
          adults: params.adults,
          children: params.children ?? 0,
          infantsInSeat: 0,
          infantsOnLap: 0,
        },
        flightSegments: segments,
        stops: toMaxStopsEnum(params.maxStops ?? "any"),
        seatType: toSeatTypeEnum(params.seatType ?? "economy"),
        fromDate: params.startDate,
        toDate: params.endDate,
        ...(params.tripDuration && { duration: params.tripDuration }),
        ...(params.maxPrice && {
          priceLimit: { maxPrice: params.maxPrice, currency: Currency.USD },
        }),
        ...(params.airlines && {
          airlines: params.airlines.map(toAirlineEnum),
        }),
      };

      // Execute search
      let results: Awaited<ReturnType<typeof searchDates.search>>;
      try {
        results = await searchDates.search(filters);
      } catch (error) {
        const errorMsg = (error as Error).message;

        // Provide more helpful error messages
        if (errorMsg.includes("HTTP 429") || errorMsg.includes("rate limit")) {
          return {
            success: false,
            message:
              "Flight search service is currently busy. Please try again in a moment.",
            dates: [],
          };
        }

        if (errorMsg.includes("timeout") || errorMsg.includes("ETIMEDOUT")) {
          return {
            success: false,
            message: "Date search timed out. Please try a smaller date range.",
            dates: [],
          };
        }

        if (errorMsg.includes("network") || errorMsg.includes("ENOTFOUND")) {
          return {
            success: false,
            message:
              "Unable to reach flight search service. Please check your connection and try again.",
            dates: [],
          };
        }

        return {
          success: false,
          message: `Unable to search dates: ${errorMsg}. Please try different search criteria.`,
          dates: [],
        };
      }

      if (!results || results.length === 0) {
        return {
          success: false,
          message: `No flights found from ${params.origin.join("/")} to ${params.destination.join("/")} between ${params.startDate} and ${params.endDate}. Try different airports or a different date range.`,
          dates: [],
        };
      }

      // Format and sort results by price
      const dates = results
        .map((result) => ({
          date:
            result.date.length === 1
              ? formatDate(result.date[0])
              : `${formatDate(result.date[0])} - ${formatDate(result.date[1])}`,
          price: result.price,
          ...(result.date.length === 2 && {
            departureDate: formatDate(result.date[0]),
            returnDate: formatDate(result.date[1]),
          }),
        }))
        .sort((a, b) => a.price - b.price);

      // Find cheapest
      const cheapest = dates[0];

      return {
        success: true,
        message: `Found ${dates.length} date${dates.length > 1 ? "s" : ""} with available flights. Cheapest: $${cheapest?.price} on ${cheapest?.date}`,
        count: dates.length,
        cheapestPrice: cheapest?.price,
        cheapestDate: cheapest?.date,
        dates,
        searchParams: {
          origin: params.origin,
          destination: params.destination,
          dateRange: `${params.startDate} to ${params.endDate}`,
          tripType: params.tripType ?? "oneway",
        },
      };
    } catch (error) {
      // Catch any unexpected errors
      return {
        success: false,
        message: `Unexpected error during date search: ${(error as Error).message}. Please try again.`,
        dates: [],
      };
    }
  },
});
