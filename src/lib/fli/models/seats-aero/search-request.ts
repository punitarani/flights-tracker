/**
 * Request parameters for seats.aero search endpoints.
 *
 * This module contains request models for querying award availability.
 */

import { z } from "zod";
import { AvailabilityTripSchema } from "./search";

/**
 * Sort order options for search results.
 */
export enum SearchOrderBy {
  /** Default ordering by date and available cabins */
  DEFAULT = "default",
  /** Order by lowest mileage cost first */
  LOWEST_MILEAGE = "lowest_mileage",
}

/**
 * Query parameters for cached search endpoint (GET /search).
 * Searches pre-cached award availability across multiple dates and sources.
 * Parameters ordered as documented in seats.aero API specification.
 */
export const SearchRequestParamsSchema = z.object({
  // Required parameters
  /** Origin airport codes (comma-delimited for multiple, e.g., "SFO,LAX") */
  origin_airport: z.string().min(3),

  /** Destination airport codes (comma-delimited for multiple, e.g., "FRA,LHR") */
  destination_airport: z.string().min(3),

  // Date range
  /** Start date for search range in YYYY-MM-DD format */
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),

  /** End date for search range in YYYY-MM-DD format */
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),

  // Pagination parameters
  /** Pagination cursor from previous response (int32) */
  cursor: z.number().int().optional(),

  /** Maximum number of results to return (10-1000, defaults to 500) */
  take: z.number().int().min(10).max(1000).default(500),

  /** Result ordering method (default: by date and available cabins, or "lowest_mileage") */
  order_by: z.string().optional(),

  /** Number of results to skip for pagination (int32) */
  skip: z.number().int().min(0).optional(),

  // Trip detail options
  /** Include detailed trip-level information in response (defaults to false) */
  include_trips: z.boolean().default(false),

  /** Only return results with direct flights available (defaults to false) */
  only_direct_flights: z.boolean().default(false),

  // Filter parameters
  /** Filter by airline carriers (comma-separated, e.g., "DL,AA") */
  carriers: z.string().optional(),

  /** Include results with raw/filtered data - prevents dynamic price filtering (defaults to false) */
  include_filtered: z.boolean().default(false),

  /** Filter by mileage programs (comma-delimited, e.g., "aeroplan,united") */
  sources: z.string().optional(),

  /** Return reduced trip fields for better performance (requires include_trips=true) */
  minify_trips: z.boolean().optional(),

  /** Filter by required cabin classes (comma-delimited, e.g., "economy,business") */
  cabins: z.string().optional(),
});

export type SearchRequestParams = z.infer<typeof SearchRequestParamsSchema>;

/**
 * Request body for live search endpoint (POST /live).
 * Performs real-time search against airline systems.
 */
export const LiveSearchRequestSchema = z.object({
  /** Origin airport IATA code */
  origin_airport: z.string().length(3),

  /** Destination airport IATA code */
  destination_airport: z.string().length(3),

  /** Departure date in YYYY-MM-DD format */
  departure_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

  /** Mileage program to search (e.g., "united", "delta", "aeroplan") */
  source: z.string(),

  /** Disable filters for dynamic pricing or mismatched airports */
  disable_filters: z.boolean().default(false),

  /** Disable only dynamic pricing filters, keep mismatched airport filters */
  show_dynamic_pricing: z.boolean().default(false),

  /** Number of adult passengers (1-9) */
  seat_count: z.number().int().min(1).max(9).default(1),
});

export type LiveSearchRequest = z.infer<typeof LiveSearchRequestSchema>;

/**
 * Booking link for a trip option.
 */
export const BookingLinkSchema = z.object({
  /** Display label for the booking link */
  label: z.string(),
  /** URL to the booking page */
  link: z.string(),
  /** Whether this is the primary/recommended booking option */
  primary: z.boolean(),
});

export type BookingLink = z.infer<typeof BookingLinkSchema>;

/**
 * Response body for live search endpoint (POST /live).
 * Contains real-time availability results from airline systems.
 */
export const LiveSearchResponseSchema = z.object({
  /** Array of trip options with availability */
  results: z.array(AvailabilityTripSchema),
  /** Booking links for the search results */
  bookingLinks: z.array(BookingLinkSchema),
  /** Whether the search completed successfully */
  success: z.boolean(),
});

export type LiveSearchResponse = z.infer<typeof LiveSearchResponseSchema>;
