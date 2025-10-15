/**
 * Models for seats.aero search endpoint.
 *
 * This module contains all the data models for the /search endpoint response.
 * The search endpoint returns award availability across multiple dates and sources.
 */

import { z } from "zod";

/**
 * Route information for a city pair.
 * Represents a specific origin-destination pair with metadata.
 */
export const RouteSchema = z.object({
  /** Unique identifier for the route */
  ID: z.string(),
  /** Origin airport IATA code */
  OriginAirport: z.string(),
  /** Geographic region of origin airport */
  OriginRegion: z.string(),
  /** Destination airport IATA code */
  DestinationAirport: z.string(),
  /** Geographic region of destination airport */
  DestinationRegion: z.string(),
  /** Number of days from today for this search */
  NumDaysOut: z.number(),
  /** Distance between airports in miles */
  Distance: z.number(),
  /** Source program for this route */
  Source: z.string(),
});

export type Route = z.infer<typeof RouteSchema>;

/**
 * A specific flight itinerary/trip option.
 * Represents a bookable journey with specific flights and pricing.
 */
export const AvailabilityTripSchema = z.object({
  /** Unique identifier for the trip */
  ID: z.string(),
  /** Associated route ID */
  RouteID: z.string(),
  /** Associated availability record ID */
  AvailabilityID: z.string(),
  /** Total journey duration in minutes */
  TotalDuration: z.number(),
  /** Number of stops (0 = direct) */
  Stops: z.number(),
  /** Operating carrier codes (comma-separated if multiple) */
  Carriers: z.string(),
  /** Number of award seats remaining */
  RemainingSeats: z.number(),
  /** Total mileage cost for this trip */
  MileageCost: z.number(),
  /** Total taxes and fees */
  TotalTaxes: z.number(),
  /** Currency code for taxes (may be undefined for some trips) */
  TaxesCurrency: z.string().optional(),
  /** Currency symbol for display (may be undefined for some trips) */
  TaxesCurrencySymbol: z.string().optional(),
  /** Total distance of all segments in miles */
  TotalSegmentDistance: z.number(),
  /** Origin airport IATA code */
  OriginAirport: z.string(),
  /** Destination airport IATA code */
  DestinationAirport: z.string(),
  /** Aircraft types used (array for multi-segment trips, may be undefined) */
  Aircraft: z.array(z.string()).optional(),
  /** Flight numbers (comma-separated if multiple) */
  FlightNumbers: z.string(),
  /** Departure time (ISO 8601 UTC) */
  DepartsAt: z.string(),
  /** Cabin class for this trip */
  Cabin: z.string(),
  /** Arrival time (ISO 8601 UTC) */
  ArrivesAt: z.string(),
  /** Record creation timestamp */
  CreatedAt: z.string(),
  /** Record last update timestamp */
  UpdatedAt: z.string(),
  /** Source program for this trip */
  Source: z.string(),
});

export type AvailabilityTrip = z.infer<typeof AvailabilityTripSchema>;

/**
 * Award availability for a specific date and route.
 * Contains availability across all cabin classes (Y/W/J/F) and associated trip options.
 */
export const AvailabilitySchema = z.object({
  /** Unique identifier for this availability record */
  ID: z.string(),
  /** Associated route ID */
  RouteID: z.string(),
  /** Route details */
  Route: RouteSchema,
  /** Travel date (YYYY-MM-DD) */
  Date: z.string(),
  /** Parsed travel date (ISO 8601 UTC) */
  ParsedDate: z.string(),

  // Economy class (Y) availability
  /** Economy seats available */
  YAvailable: z.boolean(),
  /** Raw economy availability */
  YAvailableRaw: z.boolean(),
  /** Economy mileage cost (as string) */
  YMileageCost: z.string(),
  /** Economy mileage cost (as number) */
  YMileageCostRaw: z.number(),
  /** Economy direct flight mileage cost */
  YDirectMileageCost: z.number(),
  /** Raw economy direct mileage cost */
  YDirectMileageCostRaw: z.number(),
  /** Economy total taxes */
  YTotalTaxes: z.number(),
  /** Raw economy total taxes */
  YTotalTaxesRaw: z.number(),
  /** Economy direct flight total taxes */
  YDirectTotalTaxes: z.number(),
  /** Raw economy direct total taxes */
  YDirectTotalTaxesRaw: z.number(),
  /** Economy remaining seats */
  YRemainingSeats: z.number(),
  /** Raw economy remaining seats */
  YRemainingSeatsRaw: z.number(),
  /** Economy direct flight remaining seats */
  YDirectRemainingSeats: z.number(),
  /** Raw economy direct remaining seats */
  YDirectRemainingSeatsRaw: z.number(),
  /** Economy operating airlines */
  YAirlines: z.string(),
  /** Raw economy airlines */
  YAirlinesRaw: z.string(),
  /** Economy direct flight airlines */
  YDirectAirlines: z.string(),
  /** Raw economy direct airlines */
  YDirectAirlinesRaw: z.string(),
  /** Economy direct flights available */
  YDirect: z.boolean(),
  /** Raw economy direct availability */
  YDirectRaw: z.boolean(),

  // Premium Economy class (W) availability
  /** Premium economy seats available */
  WAvailable: z.boolean(),
  /** Raw premium economy availability */
  WAvailableRaw: z.boolean(),
  /** Premium economy mileage cost (as string) */
  WMileageCost: z.string(),
  /** Premium economy mileage cost (as number) */
  WMileageCostRaw: z.number(),
  /** Premium economy direct flight mileage cost */
  WDirectMileageCost: z.number(),
  /** Raw premium economy direct mileage cost */
  WDirectMileageCostRaw: z.number(),
  /** Premium economy total taxes */
  WTotalTaxes: z.number(),
  /** Raw premium economy total taxes */
  WTotalTaxesRaw: z.number(),
  /** Premium economy direct flight total taxes */
  WDirectTotalTaxes: z.number(),
  /** Raw premium economy direct total taxes */
  WDirectTotalTaxesRaw: z.number(),
  /** Premium economy remaining seats */
  WRemainingSeats: z.number(),
  /** Raw premium economy remaining seats */
  WRemainingSeatsRaw: z.number(),
  /** Premium economy direct flight remaining seats */
  WDirectRemainingSeats: z.number(),
  /** Raw premium economy direct remaining seats */
  WDirectRemainingSeatsRaw: z.number(),
  /** Premium economy operating airlines */
  WAirlines: z.string(),
  /** Raw premium economy airlines */
  WAirlinesRaw: z.string(),
  /** Premium economy direct flight airlines */
  WDirectAirlines: z.string(),
  /** Raw premium economy direct airlines */
  WDirectAirlinesRaw: z.string(),
  /** Premium economy direct flights available */
  WDirect: z.boolean(),
  /** Raw premium economy direct availability */
  WDirectRaw: z.boolean(),

  // Business class (J) availability
  /** Business class seats available */
  JAvailable: z.boolean(),
  /** Raw business class availability */
  JAvailableRaw: z.boolean(),
  /** Business class mileage cost (as string) */
  JMileageCost: z.string(),
  /** Business class mileage cost (as number) */
  JMileageCostRaw: z.number(),
  /** Business class direct flight mileage cost */
  JDirectMileageCost: z.number(),
  /** Raw business class direct mileage cost */
  JDirectMileageCostRaw: z.number(),
  /** Business class total taxes */
  JTotalTaxes: z.number(),
  /** Raw business class total taxes */
  JTotalTaxesRaw: z.number(),
  /** Business class direct flight total taxes */
  JDirectTotalTaxes: z.number(),
  /** Raw business class direct total taxes */
  JDirectTotalTaxesRaw: z.number(),
  /** Business class remaining seats */
  JRemainingSeats: z.number(),
  /** Raw business class remaining seats */
  JRemainingSeatsRaw: z.number(),
  /** Business class direct flight remaining seats */
  JDirectRemainingSeats: z.number(),
  /** Raw business class direct remaining seats */
  JDirectRemainingSeatsRaw: z.number(),
  /** Business class operating airlines */
  JAirlines: z.string(),
  /** Raw business class airlines */
  JAirlinesRaw: z.string(),
  /** Business class direct flight airlines */
  JDirectAirlines: z.string(),
  /** Raw business class direct airlines */
  JDirectAirlinesRaw: z.string(),
  /** Business class direct flights available */
  JDirect: z.boolean(),
  /** Raw business class direct availability */
  JDirectRaw: z.boolean(),

  // First class (F) availability
  /** First class seats available */
  FAvailable: z.boolean(),
  /** Raw first class availability */
  FAvailableRaw: z.boolean(),
  /** First class mileage cost (as string) */
  FMileageCost: z.string(),
  /** First class mileage cost (as number) */
  FMileageCostRaw: z.number(),
  /** First class direct flight mileage cost */
  FDirectMileageCost: z.number(),
  /** Raw first class direct mileage cost */
  FDirectMileageCostRaw: z.number(),
  /** First class total taxes */
  FTotalTaxes: z.number(),
  /** Raw first class total taxes */
  FTotalTaxesRaw: z.number(),
  /** First class direct flight total taxes */
  FDirectTotalTaxes: z.number(),
  /** Raw first class direct total taxes */
  FDirectTotalTaxesRaw: z.number(),
  /** First class remaining seats */
  FRemainingSeats: z.number(),
  /** Raw first class remaining seats */
  FRemainingSeatsRaw: z.number(),
  /** First class direct flight remaining seats */
  FDirectRemainingSeats: z.number(),
  /** Raw first class direct remaining seats */
  FDirectRemainingSeatsRaw: z.number(),
  /** First class operating airlines */
  FAirlines: z.string(),
  /** Raw first class airlines */
  FAirlinesRaw: z.string(),
  /** First class direct flight airlines */
  FDirectAirlines: z.string(),
  /** Raw first class direct airlines */
  FDirectAirlinesRaw: z.string(),
  /** First class direct flights available */
  FDirect: z.boolean(),
  /** Raw first class direct availability */
  FDirectRaw: z.boolean(),

  // Shared fields
  /** Currency code for all tax amounts */
  TaxesCurrency: z.string(),
  /** Source program for this availability */
  Source: z.string(),
  /** Record creation timestamp */
  CreatedAt: z.string(),
  /** Record last update timestamp */
  UpdatedAt: z.string(),
  /** Array of specific trip/itinerary options */
  AvailabilityTrips: z.array(AvailabilityTripSchema).nullable(),
});

export type Availability = z.infer<typeof AvailabilitySchema>;

/**
 * Complete search response from seats.aero search endpoint.
 * Includes availability data and pagination metadata.
 */
export const SearchResponseSchema = z.object({
  /** Array of availability records for the search criteria */
  data: z.array(AvailabilitySchema),
  /** Total number of results returned in this response */
  count: z.number(),
  /** Whether more results are available */
  hasMore: z.boolean(),
  /** URL to fetch the next page of results (if hasMore is true) */
  moreURL: z.string().optional(),
  /** Cursor value for pagination */
  cursor: z.number(),
});

export type SearchResponse = z.infer<typeof SearchResponseSchema>;
