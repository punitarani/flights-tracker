import { tool } from "ai";
import { Airline } from "@/lib/fli/models/airline";
import { Airport } from "@/lib/fli/models/airport";
import {
  Currency,
  type FlightResult,
  MaxStops,
  SeatType,
  SortBy,
  TripType,
} from "@/lib/fli/models/google-flights/base";
import { SearchFlights } from "@/lib/fli/search";
import { type SearchFlightsParams, SearchFlightsParamsSchema } from "../types";

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
 * Format flight result for display.
 */
function formatFlightResult(flight: FlightResult) {
  return {
    price: flight.price,
    duration: flight.duration,
    stops: flight.stops,
    legs: flight.legs.map((leg) => ({
      airline: leg.airline,
      flightNumber: leg.flightNumber,
      departure: {
        airport: leg.departureAirport,
        dateTime: leg.departureDateTime.toISOString(),
      },
      arrival: {
        airport: leg.arrivalAirport,
        dateTime: leg.arrivalDateTime.toISOString(),
      },
      duration: leg.duration,
    })),
  };
}

/**
 * Search Flights Tool
 *
 * Searches for one-way flights between specified airports on a specific date.
 * Returns up to topN flight options with pricing and timing details.
 *
 * IMPORTANT:
 * - Always use 3-letter IATA codes for airports (SFO, JFK, LAX)
 * - Always use 2-letter codes for airlines (UA, AA, DL)
 * - For round trips, call this tool twice (outbound + return)
 */
export const searchFlightsTool = tool({
  description: `Search for one-way flights between airports. Returns available flights with prices, durations, and details.
  
Key Features:
- Multi-airport search: Search from/to multiple airports simultaneously
- Flexible filters: Seat class, stops, price limits, specific airlines
- Detailed results: Full flight legs with times, durations, and prices

Important Notes:
- This searches ONE-WAY flights only
- For round trips, make two separate searches (outbound + return)
- Always use 3-letter airport codes (SFO, JFK) and 2-letter airline codes (UA, AA)
- Dates must be in the future
- Results sorted by best overall value`,

  inputSchema: SearchFlightsParamsSchema,

  execute: async (params: SearchFlightsParams) => {
    try {
      // Validate date is not in the past
      const travelDate = new Date(params.travelDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (travelDate < today) {
        return {
          success: false,
          message: `Travel date ${params.travelDate} is in the past. Please provide a future date.`,
          flights: [],
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
          flights: [],
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
            flights: [],
          };
        }
      }

      const searchFlights = new SearchFlights();

      // Convert parameters to FlightSearchFilters
      const filters = {
        tripType: TripType.ONE_WAY,
        passengerInfo: {
          adults: params.adults,
          children: params.children ?? 0,
          infantsInSeat: 0,
          infantsOnLap: 0,
        },
        flightSegments: [
          {
            departureAirport: params.origin.map((code) => [
              toAirportEnum(code),
              0,
            ]),
            arrivalAirport: params.destination.map((code) => [
              toAirportEnum(code),
              0,
            ]),
            travelDate: params.travelDate,
          },
        ],
        stops: toMaxStopsEnum(params.maxStops ?? "any"),
        seatType: toSeatTypeEnum(params.seatType ?? "economy"),
        sortBy: SortBy.NONE,
        ...(params.maxPrice && {
          priceLimit: { maxPrice: params.maxPrice, currency: Currency.USD },
        }),
        ...(params.airlines && {
          airlines: params.airlines.map(toAirlineEnum),
        }),
      };

      // Execute search
      let results: Awaited<ReturnType<typeof searchFlights.search>>;
      try {
        results = await searchFlights.search(filters, params.topN ?? 5);
      } catch (error) {
        const errorMsg = (error as Error).message;

        // Provide more helpful error messages
        if (errorMsg.includes("HTTP 429") || errorMsg.includes("rate limit")) {
          return {
            success: false,
            message:
              "Flight search service is currently busy. Please try again in a moment.",
            flights: [],
          };
        }

        if (errorMsg.includes("timeout") || errorMsg.includes("ETIMEDOUT")) {
          return {
            success: false,
            message:
              "Flight search timed out. Please try searching fewer airports or dates.",
            flights: [],
          };
        }

        if (errorMsg.includes("network") || errorMsg.includes("ENOTFOUND")) {
          return {
            success: false,
            message:
              "Unable to reach flight search service. Please check your connection and try again.",
            flights: [],
          };
        }

        return {
          success: false,
          message: `Unable to search flights: ${errorMsg}. Please try different search criteria.`,
          flights: [],
        };
      }

      if (!results || results.length === 0) {
        return {
          success: false,
          message: `No flights found from ${params.origin.join("/")} to ${params.destination.join("/")} on ${params.travelDate}. Try different dates or airports.`,
          flights: [],
        };
      }

      // Format results
      const flights = results.map((result) => {
        if (Array.isArray(result)) {
          // This shouldn't happen for one-way searches
          return formatFlightResult(result[0]);
        }
        return formatFlightResult(result);
      });

      return {
        success: true,
        message: `Found ${flights.length} flight${flights.length > 1 ? "s" : ""} from ${params.origin.join("/")} to ${params.destination.join("/")}`,
        count: flights.length,
        flights,
        searchParams: {
          origin: params.origin,
          destination: params.destination,
          travelDate: params.travelDate,
        },
      };
    } catch (error) {
      // Catch any unexpected errors
      return {
        success: false,
        message: `Unexpected error during flight search: ${(error as Error).message}. Please try again.`,
        flights: [],
      };
    }
  },
});
