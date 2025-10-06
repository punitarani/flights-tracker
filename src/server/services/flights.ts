import { z } from "zod";

import {
  Airline,
  Airport,
  type DateSearchFilters,
  type FlightLeg,
  type FlightResult,
} from "@/lib/fli/models";
import { SearchDates, SearchFlights } from "@/lib/fli/search";

import {
  type FlightFiltersInput,
  FlightFiltersInputSchema,
  toDateSearchFilters,
  toFlightSearchFilters,
} from "../schemas/flight-filters";

const airlineReverseLookup = new Map<string, string>(
  Object.entries(Airline).map(([code, name]) => [name, code]),
);

const airportReverseLookup = new Map<string, string>(
  Object.entries(Airport).map(([code, name]) => [name, code]),
);

const defaultCurrency = "USD" as const;

export interface CalendarPriceEntry {
  date: string;
  returnDate?: string | null;
  price: number;
}

export interface CalendarPriceResult {
  currency: string;
  prices: CalendarPriceEntry[];
}

export interface FlightLegSummary {
  airlineCode: string;
  airlineName: string;
  flightNumber: string;
  departureAirportCode: string;
  departureAirportName: string;
  departureDateTime: string;
  arrivalAirportCode: string;
  arrivalAirportName: string;
  arrivalDateTime: string;
  durationMinutes: number;
}

export interface FlightSliceSummary {
  durationMinutes: number;
  stops: number;
  legs: FlightLegSummary[];
  price: number;
}

export interface FlightOption {
  totalPrice: number;
  currency: string;
  slices: FlightSliceSummary[];
}

export class FlightFiltersValidationError extends Error {
  constructor(public readonly issues: z.ZodIssue[]) {
    super("Invalid flight filters supplied");
    this.name = "FlightFiltersValidationError";
  }
}

export class FlightSearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FlightSearchError";
  }
}

export function parseFlightFiltersInput(input: unknown): FlightFiltersInput {
  const result = FlightFiltersInputSchema.safeParse(input);
  if (!result.success) {
    throw new FlightFiltersValidationError(result.error.issues);
  }
  return result.data;
}

export async function searchCalendarPrices(
  filtersInput: FlightFiltersInput,
): Promise<CalendarPriceResult> {
  let filters: DateSearchFilters;
  try {
    filters = toDateSearchFilters(filtersInput);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new FlightFiltersValidationError(error.issues);
    }
    throw error;
  }

  try {
    const search = new SearchDates();
    const results = await search.search(filters);

    const prices = (results ?? [])
      .map<CalendarPriceEntry | null>(({ date, price }) => {
        const departure = date[0]?.toISOString().split("T")[0] ?? null;
        if (!departure) {
          return null;
        }

        const returnDate = date[1]?.toISOString().split("T")[0] ?? null;

        return {
          date: departure,
          returnDate,
          price,
        };
      })
      .filter((entry): entry is CalendarPriceEntry => entry !== null)
      .sort((a, b) => a.date.localeCompare(b.date));

    const selectedDays = Array.isArray(filtersInput.daysOfWeek)
      ? Array.from(
          new Set(
            filtersInput.daysOfWeek.filter(
              (day): day is number =>
                typeof day === "number" &&
                Number.isInteger(day) &&
                day >= 0 &&
                day <= 6,
            ),
          ),
        )
      : [];

    const filteredPrices =
      selectedDays.length > 0
        ? (() => {
            const allowedDays = new Set(selectedDays);
            return prices.filter((entry) => {
              const departureDate = new Date(`${entry.date}T00:00:00Z`);
              if (Number.isNaN(departureDate.getTime())) {
                return false;
              }
              const weekday = departureDate.getUTCDay();
              return allowedDays.has(weekday);
            });
          })()
        : prices;

    return {
      currency: filters.priceLimit?.currency ?? defaultCurrency,
      prices: filteredPrices,
    };
  } catch (error) {
    throw new FlightSearchError(
      error instanceof Error ? error.message : "Failed to search calendar",
    );
  }
}

export async function searchFlights(
  filtersInput: FlightFiltersInput,
): Promise<FlightOption[]> {
  try {
    const filters = toFlightSearchFilters(filtersInput);
    const search = new SearchFlights();
    const results = await search.search(filters);
    if (!results || results.length === 0) {
      return [];
    }

    return normalizeFlightResults(results, filters.priceLimit?.currency);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new FlightFiltersValidationError(error.issues);
    }
    throw new FlightSearchError(
      error instanceof Error ? error.message : "Failed to search flights",
    );
  }
}

function normalizeFlightResults(
  results: Array<FlightResult | [FlightResult, FlightResult]>,
  currency?: string,
): FlightOption[] {
  const options: FlightOption[] = [];

  for (const entry of results) {
    if (Array.isArray(entry)) {
      const slices = entry.map((slice) => normalizeFlightSlice(slice));
      const totalPrice = slices.reduce((sum, slice) => sum + slice.price, 0);
      options.push({
        totalPrice,
        currency: currency ?? defaultCurrency,
        slices,
      });
      continue;
    }

    const slice = normalizeFlightSlice(entry);
    options.push({
      totalPrice: slice.price,
      currency: currency ?? defaultCurrency,
      slices: [slice],
    });
  }

  return options;
}

function normalizeFlightSlice(result: FlightResult): FlightSliceSummary {
  return {
    durationMinutes: result.duration,
    stops: result.stops,
    price: result.price,
    legs: result.legs.map((leg) => normalizeFlightLeg(leg)),
  };
}

function normalizeFlightLeg(leg: FlightLeg): FlightLegSummary {
  return {
    airlineCode: lookupAirlineCode(leg.airline),
    airlineName: leg.airline,
    flightNumber: leg.flightNumber,
    departureAirportCode: lookupAirportCode(leg.departureAirport),
    departureAirportName: leg.departureAirport,
    departureDateTime: leg.departureDateTime.toISOString(),
    arrivalAirportCode: lookupAirportCode(leg.arrivalAirport),
    arrivalAirportName: leg.arrivalAirport,
    arrivalDateTime: leg.arrivalDateTime.toISOString(),
    durationMinutes: leg.duration,
  };
}

function lookupAirportCode(airportName: string): string {
  const code = airportReverseLookup.get(airportName);
  if (!code) {
    throw new Error(`Unknown airport: ${airportName}`);
  }
  return code;
}

function lookupAirlineCode(airlineName: string): string {
  const code = airlineReverseLookup.get(airlineName);
  if (!code) {
    throw new Error(`Unknown airline: ${airlineName}`);
  }
  return code.replace(/^_/, "");
}
