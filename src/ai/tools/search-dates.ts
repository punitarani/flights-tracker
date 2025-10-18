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
          message: "Trip duration is required for round trip searches",
          dates: [],
        };
      }

      const searchDates = new SearchDates();
      const tripType = toTripTypeEnum(params.tripType ?? "oneway");

      // Build flight segments
      const firstTravelDate = formatDate(params.startDate);
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
        fromDate: formatDate(params.startDate),
        toDate: formatDate(params.endDate),
        ...(params.tripDuration && { duration: params.tripDuration }),
        ...(params.maxPrice && {
          priceLimit: { maxPrice: params.maxPrice, currency: Currency.USD },
        }),
        ...(params.airlines && {
          airlines: params.airlines.map(toAirlineEnum),
        }),
      };

      // Execute search
      const results = await searchDates.search(filters);

      if (!results || results.length === 0) {
        return {
          success: false,
          message: "No flights found in this date range",
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
        message: `Found ${dates.length} date${dates.length > 1 ? "s" : ""} with flights`,
        count: dates.length,
        cheapestPrice: cheapest?.price,
        cheapestDate: cheapest?.date,
        dates,
        searchParams: {
          origin: params.origin,
          destination: params.destination,
          dateRange: `${formatDate(params.startDate)} to ${formatDate(params.endDate)}`,
          tripType: params.tripType ?? "oneway",
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Date search failed: ${(error as Error).message}`,
        dates: [],
      };
    }
  },
});
