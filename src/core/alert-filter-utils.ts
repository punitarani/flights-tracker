import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfDay,
} from "date-fns";
import { SEARCH_WINDOW_OPTIONS } from "@/components/flight-explorer/constants";
import { MaxStops, SeatType } from "@/lib/fli/models";
import type {
  AlertFiltersV1,
  AlertTimeRange,
  SeatClass,
  Stops,
} from "./filters";

const SEARCH_WINDOW_SET = new Set<number>(SEARCH_WINDOW_OPTIONS);
const SEAT_CLASS_VALUES: ReadonlyArray<SeatClass> = [
  "ECONOMY",
  "PREMIUM_ECONOMY",
  "BUSINESS",
  "FIRST",
];
const STOPS_VALUES: ReadonlyArray<Stops> = [
  "ANY",
  "NONSTOP",
  "ONE_STOP",
  "TWO_STOPS",
];

const SEAT_QUERY_MAP: Record<SeatClass, SeatType> = {
  ECONOMY: SeatType.ECONOMY,
  PREMIUM_ECONOMY: SeatType.PREMIUM_ECONOMY,
  BUSINESS: SeatType.BUSINESS,
  FIRST: SeatType.FIRST,
};

const STOP_QUERY_MAP: Record<Stops, MaxStops> = {
  ANY: MaxStops.ANY,
  NONSTOP: MaxStops.NON_STOP,
  ONE_STOP: MaxStops.ONE_STOP_OR_FEWER,
  TWO_STOPS: MaxStops.TWO_OR_FEWER_STOPS,
};

export const FULL_DAY_TIME_RANGE = {
  from: 0,
  to: 24,
} as const;

export type SanitizedTimeRange = {
  from?: number;
  to?: number;
};

export type NormalizedAlertFilters = {
  origin: string;
  destination: string;
  dateFrom: Date;
  dateTo: Date;
  dateFromIso: string;
  dateToIso: string;
  searchWindowDays: number;
  airlines: string[];
  seatClass?: SeatClass;
  stops?: Stops;
  departureTimeRange?: SanitizedTimeRange;
  arrivalTimeRange?: SanitizedTimeRange;
};

function clampSearchWindowDays(days: number): number {
  if (SEARCH_WINDOW_SET.has(days)) {
    return days;
  }

  return SEARCH_WINDOW_OPTIONS.reduce((closest, option) => {
    const diff = Math.abs(option - days);
    const bestDiff = Math.abs(closest - days);
    return diff < bestDiff ? option : closest;
  }, SEARCH_WINDOW_OPTIONS[0]);
}

function clampTimeBound(value: number): number {
  return Math.min(Math.max(Math.round(value), 0), 24);
}

function sanitizeIataCode(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(trimmed) ? trimmed : null;
}

function parseIsoDateStrict(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  try {
    const parsed = parseISO(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return startOfDay(parsed);
  } catch {
    return null;
  }
}

export function normalizeAirlineCodes(codes: string[] | undefined): string[] {
  if (!codes || codes.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  for (const code of codes) {
    if (typeof code !== "string") {
      continue;
    }

    const sanitized = code.trim().toUpperCase();
    if (/^[A-Z0-9]{2}$/.test(sanitized)) {
      seen.add(sanitized);
    }
  }

  return Array.from(seen);
}

export function serializeTimeRangeForAlert(
  range: { from: number; to: number } | null | undefined,
  defaults: { from: number; to: number } = FULL_DAY_TIME_RANGE,
): AlertTimeRange | undefined {
  if (!range) {
    return undefined;
  }

  let from = clampTimeBound(range.from);
  let to = clampTimeBound(range.to);

  if (from > to) {
    [from, to] = [to, from];
  }

  const defaultFrom = clampTimeBound(defaults.from);
  const defaultTo = clampTimeBound(defaults.to);

  const result: AlertTimeRange = {};

  if (from !== defaultFrom) {
    result.from = from;
  }

  if (to !== defaultTo) {
    result.to = to;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function sanitizeAlertTimeRange(
  range: AlertTimeRange | undefined,
): SanitizedTimeRange | null {
  if (!range) {
    return null;
  }

  const rawFrom = range.from;
  const rawTo = range.to;

  const from =
    typeof rawFrom === "number" && Number.isFinite(rawFrom)
      ? clampTimeBound(rawFrom)
      : undefined;
  const to =
    typeof rawTo === "number" && Number.isFinite(rawTo)
      ? clampTimeBound(rawTo)
      : undefined;

  if (from === undefined && to === undefined) {
    return null;
  }

  let normalizedFrom = from;
  let normalizedTo = to;
  if (
    normalizedFrom !== undefined &&
    normalizedTo !== undefined &&
    normalizedFrom > normalizedTo
  ) {
    [normalizedFrom, normalizedTo] = [normalizedTo, normalizedFrom];
  }

  const result: SanitizedTimeRange = {};

  if (
    normalizedFrom !== undefined &&
    normalizedFrom !== FULL_DAY_TIME_RANGE.from
  ) {
    result.from = normalizedFrom;
  }

  if (normalizedTo !== undefined && normalizedTo !== FULL_DAY_TIME_RANGE.to) {
    result.to = normalizedTo;
  }

  return Object.keys(result).length > 0 ? result : null;
}

export function normalizeAlertFilters(
  filters: AlertFiltersV1,
): NormalizedAlertFilters | null {
  const origin = sanitizeIataCode(filters.route?.from);
  const destination = sanitizeIataCode(filters.route?.to);

  if (!origin || !destination) {
    return null;
  }

  const criteria = filters.filters ?? {};
  const dateFrom = parseIsoDateStrict(criteria.dateFrom);
  const dateTo = parseIsoDateStrict(criteria.dateTo);

  if (!dateFrom || !dateTo) {
    return null;
  }

  const totalDays = Math.max(1, differenceInCalendarDays(dateTo, dateFrom) + 1);
  const searchWindowDays = clampSearchWindowDays(totalDays);
  const alignedDateTo = addDays(dateFrom, searchWindowDays - 1);

  const airlines = normalizeAirlineCodes(criteria.airlines ?? []);

  const seatClass = criteria.class;
  const resolvedSeatClass = SEAT_CLASS_VALUES.includes(seatClass as SeatClass)
    ? (seatClass as SeatClass)
    : undefined;

  const stops = criteria.stops;
  const resolvedStops = STOPS_VALUES.includes(stops as Stops)
    ? (stops as Stops)
    : undefined;

  const departureTimeRange = sanitizeAlertTimeRange(
    criteria.departureTimeRange,
  );
  const arrivalTimeRange = sanitizeAlertTimeRange(criteria.arrivalTimeRange);

  return {
    origin,
    destination,
    dateFrom,
    dateTo: alignedDateTo,
    dateFromIso: format(dateFrom, "yyyy-MM-dd"),
    dateToIso: format(alignedDateTo, "yyyy-MM-dd"),
    searchWindowDays,
    airlines,
    seatClass: resolvedSeatClass,
    stops: resolvedStops,
    departureTimeRange: departureTimeRange ?? undefined,
    arrivalTimeRange: arrivalTimeRange ?? undefined,
  };
}

export function buildSearchParamsFromNormalizedFilters(
  normalized: NormalizedAlertFilters,
): URLSearchParams {
  const params = new URLSearchParams({
    origin: normalized.origin,
    destination: normalized.destination,
    dateFrom: normalized.dateFromIso,
    dateTo: normalized.dateToIso,
    searchWindowDays: normalized.searchWindowDays.toString(),
  });

  if (normalized.stops) {
    const stopsValue = STOP_QUERY_MAP[normalized.stops];
    if (typeof stopsValue === "number" && stopsValue !== MaxStops.ANY) {
      params.set("stops", stopsValue.toString());
    }
  }

  if (normalized.seatClass && normalized.seatClass !== "ECONOMY") {
    const seatValue = SEAT_QUERY_MAP[normalized.seatClass];
    if (typeof seatValue === "number" && seatValue !== SeatType.ECONOMY) {
      params.set("seatType", seatValue.toString());
    }
  }

  if (normalized.airlines.length > 0) {
    params.set("airlines", normalized.airlines.join(","));
  }

  if (normalized.departureTimeRange) {
    if (normalized.departureTimeRange.from !== undefined) {
      params.set(
        "departureTimeFrom",
        normalized.departureTimeRange.from.toString(),
      );
    }
    if (normalized.departureTimeRange.to !== undefined) {
      params.set(
        "departureTimeTo",
        normalized.departureTimeRange.to.toString(),
      );
    }
  }

  if (normalized.arrivalTimeRange) {
    if (normalized.arrivalTimeRange.from !== undefined) {
      params.set(
        "arrivalTimeFrom",
        normalized.arrivalTimeRange.from.toString(),
      );
    }
    if (normalized.arrivalTimeRange.to !== undefined) {
      params.set("arrivalTimeTo", normalized.arrivalTimeRange.to.toString());
    }
  }

  return params;
}

export function alertFiltersToSearchParams(
  filters: AlertFiltersV1,
): URLSearchParams | null {
  const normalized = normalizeAlertFilters(filters);
  if (!normalized) {
    return null;
  }

  return buildSearchParamsFromNormalizedFilters(normalized);
}
