import type {
  DailyAlertSummary,
  DailyPriceUpdateEmail,
  FlightOptionSummary,
  PriceDropAlertEmail,
} from "./types";

type FlightSummary = {
  price: number;
  currency: string;
  totalDurationMinutes: number;
  totalStops: number;
  airlines: string[];
  departure: {
    airport: string;
    dateTime: string;
  } | null;
  arrival: {
    airport: string;
    dateTime: string;
  } | null;
};

function summarizeFlight(option: FlightOptionSummary): FlightSummary {
  const firstLeg = option.slices[0]?.legs[0] ?? null;
  const lastSlice = option.slices[option.slices.length - 1];
  const lastLeg = lastSlice?.legs[lastSlice.legs.length - 1] ?? null;

  const totalDuration = option.slices.reduce(
    (acc, slice) => acc + (slice.durationMinutes ?? 0),
    0,
  );
  const totalStops = option.slices.reduce((acc, slice) => acc + slice.stops, 0);
  const airlines = Array.from(
    new Set(
      option.slices
        .flatMap((slice) => slice.legs)
        .map((leg) => leg.airlineCode ?? leg.airlineName),
    ),
  ).filter(Boolean) as string[];

  return {
    price: option.totalPrice,
    currency: option.currency,
    totalDurationMinutes: totalDuration,
    totalStops,
    airlines,
    departure: firstLeg
      ? {
          airport: firstLeg.departureAirportCode,
          dateTime: firstLeg.departureDateTime,
        }
      : null,
    arrival: lastLeg
      ? {
          airport: lastLeg.arrivalAirportCode,
          dateTime: lastLeg.arrivalDateTime,
        }
      : null,
  };
}

function summarizeFlights(flights: FlightOptionSummary[], limit = 5) {
  return flights.slice(0, limit).map((flight) => ({
    summary: summarizeFlight(flight),
    raw: flight,
  }));
}

export function buildPriceDropBlueprintContext(payload: PriceDropAlertEmail) {
  const summaries = summarizeFlights(payload.flights, 4);
  const lowest = summaries[0]?.summary ?? null;
  const previousPrice = payload.previousLowestPrice?.amount ?? null;
  const currentPrice = payload.newLowestPrice?.amount ?? lowest?.price ?? null;
  const savings =
    previousPrice && currentPrice ? previousPrice - currentPrice : null;

  return {
    alert: {
      id: payload.alert.id,
      label: payload.alert.label,
      origin: payload.alert.origin,
      destination: payload.alert.destination,
      seatType: payload.alert.seatType,
      stops: payload.alert.stops,
      airlines: payload.alert.airlines,
      priceLimit: payload.alert.priceLimit,
    },
    detectedAt: payload.detectedAt,
    flights: summaries.map(({ summary }) => summary),
    priceDelta: {
      previous: payload.previousLowestPrice?.amount ?? undefined,
      current: currentPrice ?? undefined,
      currency:
        payload.newLowestPrice?.currency ??
        payload.alert.priceLimit?.currency ??
        lowest?.currency,
      savings: savings ?? undefined,
      savingsPercent:
        savings && previousPrice
          ? Number(((savings / previousPrice) * 100).toFixed(1))
          : undefined,
    },
    metrics: {
      flightCount: payload.flights.length,
      nonstopOptions: payload.flights.filter((flight) =>
        flight.slices.every((slice) => slice.stops === 0),
      ).length,
      airlinesCovered: Array.from(
        new Set(
          payload.flights
            .flatMap((flight) => flight.slices)
            .flatMap((slice) => slice.legs)
            .map((leg) => leg.airlineCode ?? leg.airlineName),
        ),
      ).filter(Boolean).length,
    },
  };
}

function summarizeDailyAlert(entry: DailyAlertSummary) {
  const summaries = summarizeFlights(entry.flights, 3);
  const best = summaries[0]?.summary ?? null;

  return {
    alert: {
      id: entry.alert.id,
      label: entry.alert.label,
      origin: entry.alert.origin,
      destination: entry.alert.destination,
      seatType: entry.alert.seatType,
      stops: entry.alert.stops,
      airlines: entry.alert.airlines,
      priceLimit: entry.alert.priceLimit,
    },
    generatedAt: entry.generatedAt,
    flights: summaries.map(({ summary }) => summary),
    best,
  };
}

function deriveDailyHighlights(
  alerts: ReturnType<typeof summarizeDailyAlert>[],
) {
  const highlights: string[] = [];

  if (alerts.length === 0) {
    return highlights;
  }

  const bestSavings = alerts
    .flatMap((entry) => entry.flights)
    .filter((flight) => flight.price > 0)
    .sort((a, b) => a.price - b.price)[0];

  if (bestSavings) {
    highlights.push(
      `Top deal: ${bestSavings.price.toFixed(0)} ${bestSavings.currency} from ${bestSavings.departure?.airport ?? ""} to ${bestSavings.arrival?.airport ?? ""}`,
    );
  }

  const nonstopCount = alerts.reduce(
    (acc, entry) =>
      acc + entry.flights.filter((flight) => flight.totalStops === 0).length,
    0,
  );
  if (nonstopCount > 0) {
    highlights.push(`${nonstopCount} nonstop options discovered today.`);
  }

  return highlights;
}

export function buildDailyDigestBlueprintContext(
  payload: DailyPriceUpdateEmail,
) {
  const alertSummaries = payload.alerts.map(summarizeDailyAlert);
  const totalFlights = alertSummaries.reduce(
    (acc, entry) => acc + entry.flights.length,
    0,
  );

  return {
    date: payload.summaryDate,
    alerts: alertSummaries,
    highlights: deriveDailyHighlights(alertSummaries),
    aggregateMetrics: {
      alertCount: payload.alerts.length,
      flightOptions: totalFlights,
      uniqueRoutes: new Set(
        alertSummaries.map(
          (entry) => `${entry.alert.origin}-${entry.alert.destination}`,
        ),
      ).size,
    },
  };
}
