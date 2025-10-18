import type {
  ChatUIComponent,
  ComparisonTableData,
  FlightCardData,
  PageView,
  PriceChartData,
  RouteSummaryData,
} from "../schemas/planner-view";
import type { AirportData } from "./airports";
import type { CalendarPriceEntry, FlightOption } from "./flights";

/**
 * UI Component Generator for Chat Messages
 * Determines what UI components to show based on query context and data
 */

/**
 * Generate flight cards from flight options
 */
export function generateFlightCards(
  flights: FlightOption[],
): ChatUIComponent | null {
  if (flights.length === 0) return null;

  const cards: FlightCardData[] = flights.slice(0, 5).map((flight, idx) => {
    const firstSlice = flight.slices[0];
    const firstLeg = firstSlice?.legs[0];
    const lastLeg = firstSlice?.legs[firstSlice.legs.length - 1];

    return {
      id: `flight-${idx}`,
      origin: firstLeg?.departureAirportCode || "",
      destination: lastLeg?.arrivalAirportCode || "",
      departureDate: firstLeg?.departureDateTime.split("T")[0] || "",
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
      departureTime: firstLeg?.departureDateTime.split("T")[1]?.slice(0, 5),
      arrivalTime: lastLeg?.arrivalDateTime.split("T")[1]?.slice(0, 5),
    };
  });

  return {
    type: "flightCards",
    data: cards,
  };
}

/**
 * Generate price chart from calendar data
 */
export function generatePriceChart(
  prices: CalendarPriceEntry[],
  origin: string,
  destination: string,
): ChatUIComponent | null {
  if (prices.length === 0) return null;

  const sorted = [...prices].sort((a, b) => a.price - b.price);
  const cheapest = sorted[0];

  const chartData: PriceChartData = {
    route: `${origin} → ${destination}`,
    data: prices.map((p) => ({
      date: p.date,
      price: p.price,
    })),
    currency: "USD",
    cheapestDate: cheapest?.date,
  };

  return {
    type: "priceChart",
    data: chartData,
  };
}

/**
 * Generate comparison table for multiple routes
 */
export function generateComparisonTable(
  routeResults: Array<{
    origin: string;
    destination: string;
    flights: FlightOption[];
  }>,
): ChatUIComponent | null {
  if (routeResults.length === 0) return null;

  const tableData: ComparisonTableData = {
    routes: routeResults.map((route) => {
      if (route.flights.length === 0) {
        return {
          origin: route.origin,
          destination: route.destination,
          cheapestPrice: 0,
          avgPrice: 0,
          bestDate: "",
          stops: 0,
          airlines: [],
        };
      }

      const prices = route.flights.map((f) => f.totalPrice);
      const cheapest = Math.min(...prices);
      const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
      const cheapestFlight = route.flights.find(
        (f) => f.totalPrice === cheapest,
      );

      return {
        origin: route.origin,
        destination: route.destination,
        cheapestPrice: cheapest,
        avgPrice: Math.round(avg),
        bestDate:
          cheapestFlight?.slices[0]?.legs[0]?.departureDateTime.split("T")[0] ||
          "",
        stops: cheapestFlight
          ? Math.max(...cheapestFlight.slices.map((s) => s.stops))
          : 0,
        airlines: cheapestFlight
          ? [
              ...new Set(
                cheapestFlight.slices.flatMap((s) =>
                  s.legs.map((l) => l.airlineCode),
                ),
              ),
            ]
          : [],
      };
    }),
  };

  return {
    type: "comparisonTable",
    data: tableData,
  };
}

/**
 * Generate route summary card
 */
export function generateRouteSummary(
  origin: string,
  destination: string,
  distance?: number,
  avgPrice?: number,
  cheapestDate?: string,
  airlines?: string[],
): ChatUIComponent | null {
  const summaryData: RouteSummaryData = {
    origin,
    destination,
    distance,
    avgPrice,
    cheapestDate,
    popularAirlines: airlines,
  };

  return {
    type: "routeSummary",
    data: summaryData,
  };
}

/**
 * Determine which UI components to generate based on context
 */
export function determineUIComponents(context: {
  hasFlights?: boolean;
  hasPrices?: boolean;
  multipleRoutes?: boolean;
  flightCount?: number;
}): {
  showFlightCards: boolean;
  showPriceChart: boolean;
  showComparison: boolean;
  showRouteSummary: boolean;
} {
  return {
    showFlightCards: Boolean(
      context.hasFlights && (context.flightCount || 0) > 0,
    ),
    showPriceChart: Boolean(context.hasPrices && !context.multipleRoutes),
    showComparison: Boolean(context.multipleRoutes),
    showRouteSummary: Boolean(!context.hasFlights && context.hasPrices),
  };
}

/**
 * Determine page view mode based on query and data
 */
export function determinePageView(context: {
  hasOrigin: boolean;
  hasDestination: boolean;
  hasFlights: boolean;
  multipleRoutes: boolean;
  originAirport?: AirportData;
  destAirport?: AirportData;
  flightCount?: number;
}): PageView {
  // If we have specific route with flights, show search view
  if (
    context.hasOrigin &&
    context.hasDestination &&
    context.hasFlights &&
    context.originAirport &&
    context.destAirport
  ) {
    return {
      mode: "search",
      route: {
        origin: {
          code: context.originAirport.iata,
          city: context.originAirport.city,
          country: context.originAirport.country,
          lat: context.originAirport.latitude,
          lon: context.originAirport.longitude,
        },
        destination: {
          code: context.destAirport.iata,
          city: context.destAirport.city,
          country: context.destAirport.country,
          lat: context.destAirport.latitude,
          lon: context.destAirport.longitude,
        },
      },
      flightCount: context.flightCount || 0,
    };
  }

  // If we have specific route but no flights yet, show on map
  if (
    context.hasOrigin &&
    context.hasDestination &&
    context.originAirport &&
    context.destAirport
  ) {
    return {
      mode: "map",
      view: "route",
      data: {
        origin: {
          code: context.originAirport.iata,
          city: context.originAirport.city,
          country: context.originAirport.country,
          lat: context.originAirport.latitude,
          lon: context.originAirport.longitude,
        },
        destination: {
          code: context.destAirport.iata,
          city: context.destAirport.city,
          country: context.destAirport.country,
          lat: context.destAirport.latitude,
          lon: context.destAirport.longitude,
        },
      },
    };
  }

  // If comparing multiple routes, show comparison view
  if (context.multipleRoutes) {
    return {
      mode: "comparison",
      routes: [], // Will be populated by caller
      priceData: [],
    };
  }

  // Default: show popular routes on map
  return {
    mode: "map",
    view: "popular",
  };
}
