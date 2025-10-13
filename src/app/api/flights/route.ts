import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { FlightFiltersInputSchema } from "@/server/schemas/flight-filters";
import { searchFlights } from "@/server/services/flights";

/**
 * Flight search API endpoint
 * Used by Cloudflare Worker to fetch flight data for alerts
 *
 * This is a simple wrapper around the tRPC flight search logic
 * to provide a REST endpoint for the worker
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Build flight filters from query parameters
    const input = {
      tripType: searchParams.get("tripType") || "ONE_WAY",
      segments: [
        {
          origin: searchParams.get("origin") || "",
          destination: searchParams.get("destination") || "",
          departureDate: searchParams.get("dateFrom") || "",
        },
      ],
      dateRange: {
        from: searchParams.get("dateFrom") || "",
        to: searchParams.get("dateTo") || searchParams.get("dateFrom") || "",
      },
      seatType: searchParams.get("seatType")
        ? Number.parseInt(searchParams.get("seatType") || "0", 10)
        : undefined,
      stops: searchParams.get("stops")
        ? Number.parseInt(searchParams.get("stops") || "0", 10)
        : undefined,
      airlines: searchParams.get("airlines")?.split(",").filter(Boolean),
      priceLimit: searchParams.get("maxPrice")
        ? {
            amount: Number.parseInt(searchParams.get("maxPrice") || "0", 10),
            currency: "USD",
          }
        : undefined,
    };

    // Validate input
    const validatedInput = FlightFiltersInputSchema.parse(input);

    // Search for flights
    const flights = await searchFlights(validatedInput);

    return NextResponse.json({ flights });
  } catch (error) {
    logger.error("Flight search API error", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "Failed to search flights",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
