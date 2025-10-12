/**
 * seats.aero API models.
 *
 * This module provides TypeScript models and Zod schemas for the seats.aero API.
 * seats.aero is a service that aggregates award flight availability across multiple
 * frequent flyer programs.
 *
 * @module seats-aero
 */

// Database models (frontend-safe types)
export type {
  CabinClass as CabinClassModel,
  SeatsAeroAvailabilityTripModel,
  SeatsAeroSearchRequestModel,
  SeatsAeroSearchRequestStatus,
} from "./availability-trip";
// Base types and enums
export {
  type CabinAvailability,
  CabinAvailabilitySchema,
  CabinClass,
  Currency,
  Region,
  Source,
} from "./base";
// Search endpoint models
export {
  type Availability,
  AvailabilitySchema,
  type AvailabilityTrip,
  AvailabilityTripSchema,
  type Route,
  RouteSchema,
  type SearchResponse,
  SearchResponseSchema,
} from "./search";
// Search request models
export {
  type BookingLink,
  BookingLinkSchema,
  type LiveSearchRequest,
  LiveSearchRequestSchema,
  type LiveSearchResponse,
  LiveSearchResponseSchema,
  SearchOrderBy,
  type SearchRequestParams,
  SearchRequestParamsSchema,
} from "./search-request";
