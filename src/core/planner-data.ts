import { addDays, format, parseISO, startOfDay } from "date-fns";
import { Currency } from "@/lib/fli/models";
import type { FlightFiltersInput } from "@/server/schemas/flight-filters";
import type {
  PlanItineraryInput,
  PlannerFlightOption,
} from "@/server/schemas/planner";
import type {
  CalendarPriceEntry,
  FlightOption,
} from "@/server/services/flights";

/**
 * Pure helper functions for planner data transformation
 * No side effects, suitable for reuse in agent and UI layers
 */

/**
 * Derives flight filters from user prompt and optional overrides
 * Provides sensible defaults for date ranges and other parameters
 */
export function deriveFlightFilters(
  input: PlanItineraryInput,
  defaults?: Partial<FlightFiltersInput>,
): Partial<FlightFiltersInput> {
  const filters: Partial<FlightFiltersInput> = {
    ...defaults,
  };

  // Apply structured overrides if provided
  if (input.filters?.origin) {
    filters.segments = filters.segments || [
      { origin: "", destination: "", departureDate: "" },
    ];
    filters.segments[0].origin = input.filters.origin;
  }

  if (input.filters?.destination) {
    filters.segments = filters.segments || [
      { origin: "", destination: "", departureDate: "" },
    ];
    filters.segments[0].destination = input.filters.destination;
  }

  if (input.filters?.dateFrom && input.filters?.dateTo) {
    filters.dateRange = {
      from: input.filters.dateFrom,
      to: input.filters.dateTo,
    };
  } else if (!filters.dateRange) {
    // Default to next 30 days if not specified
    const today = startOfDay(new Date());
    const futureDate = addDays(today, 30);
    filters.dateRange = {
      from: format(today, "yyyy-MM-dd"),
      to: format(futureDate, "yyyy-MM-dd"),
    };
  }

  if (input.filters?.maxPrice) {
    filters.priceLimit = {
      amount: input.filters.maxPrice,
      currency: Currency.USD,
    };
  }

  return filters;
}

/**
 * Merges calendar price data with detailed flight options
 * Selects best-priced itineraries across date range
 */
export function mergeCalendarAndOptions(
  calendarResults: CalendarPriceEntry[],
  flightOptions: FlightOption[],
): Array<CalendarPriceEntry & { options: FlightOption[] }> {
  // Group flight options by date
  const optionsByDate = new Map<string, FlightOption[]>();

  for (const option of flightOptions) {
    // Extract departure date from first slice
    const departureDate = option.slices[0]?.legs[0]?.departureDateTime;
    if (!departureDate) continue;

    const dateKey = format(parseISO(departureDate), "yyyy-MM-dd");
    const existing = optionsByDate.get(dateKey) || [];
    existing.push(option);
    optionsByDate.set(dateKey, existing);
  }

  // Merge with calendar data
  return calendarResults.map((entry) => ({
    ...entry,
    options: optionsByDate.get(entry.date) || [],
  }));
}

/**
 * Converts detailed FlightOption to lightweight planner DTO
 * Reduces payload size for client consumption
 */
export function toPlannedFlightOption(
  option: FlightOption,
): PlannerFlightOption {
  const firstSlice = option.slices[0];
  const lastSlice = option.slices[option.slices.length - 1];

  if (!firstSlice || !lastSlice) {
    throw new Error("Invalid flight option: missing slices");
  }

  const departureDate =
    firstSlice.legs[0]?.departureDateTime ||
    new Date().toISOString().split("T")[0];
  const returnDate =
    option.slices.length > 1
      ? lastSlice.legs[lastSlice.legs.length - 1]?.departureDateTime || null
      : null;

  // Extract unique airlines
  const airlines = Array.from(
    new Set(
      option.slices.flatMap((slice) =>
        slice.legs.map((leg) => leg.airlineCode),
      ),
    ),
  );

  return {
    origin: firstSlice.legs[0]?.departureAirportCode || "",
    destination:
      firstSlice.legs[firstSlice.legs.length - 1]?.arrivalAirportCode || "",
    departureDate: format(parseISO(departureDate), "yyyy-MM-dd"),
    returnDate: returnDate ? format(parseISO(returnDate), "yyyy-MM-dd") : null,
    price: option.totalPrice,
    currency: option.currency,
    stops: Math.max(...option.slices.map((s) => s.stops)),
    duration: option.slices.reduce((sum, s) => sum + s.durationMinutes, 0),
    airlines,
  };
}

/**
 * In-memory cache for deduplicating search calls within single agent run
 * Key: serialized search params, Value: cached result
 */
export class PlannerCache {
  private cache: Map<string, unknown> = new Map();

  constructor(private readonly ttlMs: number = 60000) {}

  get<T>(key: string): T | undefined {
    return this.cache.get(key) as T | undefined;
  }

  set<T>(key: string, value: T): void {
    this.cache.set(key, value);

    // Auto-expire after TTL
    setTimeout(() => {
      this.cache.delete(key);
    }, this.ttlMs);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Generates cache key for flight search params
 */
export function generateSearchCacheKey(
  filters: Partial<FlightFiltersInput>,
): string {
  return JSON.stringify({
    segments: filters.segments,
    dateRange: filters.dateRange,
    airlines: filters.airlines,
    priceLimit: filters.priceLimit,
    stops: filters.stops,
    seatType: filters.seatType,
  });
}

/**
 * Extracts likely intent from natural language prompt
 * Returns structured hints for agent tool selection
 */
export function extractPromptIntent(prompt: string): {
  hasOrigin: boolean;
  hasDestination: boolean;
  hasBudget: boolean;
  hasDates: boolean;
  needsInspiration: boolean;
} {
  const lower = prompt.toLowerCase();

  return {
    hasOrigin: /\bfrom\b/.test(lower) || /\bleaving\b/.test(lower),
    hasDestination: /\bto\b/.test(lower) || /\bgoing\b/.test(lower),
    hasBudget: /\$\d+/.test(prompt) || /\bbudget\b/.test(lower),
    hasDates:
      /\b\d{4}-\d{2}-\d{2}\b/.test(prompt) ||
      /\bnext (week|month|year)\b/.test(lower) ||
      /\bin (january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(
        lower,
      ),
    needsInspiration:
      /\banywhere\b/.test(lower) ||
      /\bsurprise\b/.test(lower) ||
      /\brecommend\b/.test(lower),
  };
}
