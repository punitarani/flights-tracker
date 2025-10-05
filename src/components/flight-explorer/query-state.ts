import {
  type inferParserType,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
} from "nuqs";
import { createSearchParamsCache } from "nuqs/server";

export const flightExplorerQueryParsers = {
  // Route - using IATA codes
  origin: parseAsString,
  destination: parseAsString,

  // Date Range
  dateFrom: parseAsString,
  dateTo: parseAsString,
  searchWindowDays: parseAsInteger,

  // Time Ranges (only when customized, defaults handled in hook)
  departureTimeFrom: parseAsInteger,
  departureTimeTo: parseAsInteger,
  arrivalTimeFrom: parseAsInteger,
  arrivalTimeTo: parseAsInteger,

  // Flight Preferences (only when non-default)
  seatType: parseAsInteger,
  stops: parseAsInteger,
  airlines: parseAsArrayOf(parseAsString, ","),

  // Selected date for flight details
  selectedDate: parseAsString,
} as const;

export type FlightExplorerQueryState = inferParserType<
  typeof flightExplorerQueryParsers
>;

export const flightExplorerSearchParamsCache = createSearchParamsCache(
  flightExplorerQueryParsers,
);
