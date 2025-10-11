/**
 * Base models and enums for seats.aero API.
 *
 * This module contains shared types used across different seats.aero endpoints.
 */

import { z } from "zod";

/**
 * Available cabin classes in airline award bookings.
 * These correspond to the cabin class codes used by airlines.
 */
export enum CabinClass {
  /** Economy / Coach class (Y) */
  ECONOMY = "economy",
  /** Premium Economy class (W) */
  PREMIUM_ECONOMY = "premium_economy",
  /** Business class (J) */
  BUSINESS = "business",
  /** First class (F) */
  FIRST = "first",
}

/**
 * Supported source programs/airlines for award availability.
 * These represent the different frequent flyer programs that can be searched.
 */
export enum Source {
  AEROPLAN = "aeroplan",
  ALASKA = "alaska",
  AMERICAN = "american",
  LIFEMILES = "lifemiles",
  QANTAS = "qantas",
  SMILES = "smiles",
  UNITED = "united",
  VELOCITY = "velocity",
  VIRGIN = "virgin",
}

/**
 * Geographic regions for airport classification.
 */
export enum Region {
  NORTH_AMERICA = "North America",
  EUROPE = "Europe",
  ASIA = "Asia",
  OCEANIA = "Oceania",
  SOUTH_AMERICA = "South America",
  AFRICA = "Africa",
  MIDDLE_EAST = "Middle East",
  CARIBBEAN = "Caribbean",
}

/**
 * Currency codes supported by the API.
 */
export enum Currency {
  USD = "USD",
  EUR = "EUR",
  GBP = "GBP",
  CAD = "CAD",
  AUD = "AUD",
}

/**
 * Base schema for cabin availability data.
 * Contains fields common to all cabin classes (Y, W, J, F).
 */
export const CabinAvailabilitySchema = z.object({
  /** Whether award seats are available in this cabin */
  available: z.boolean(),
  /** Raw availability flag (unprocessed) */
  availableRaw: z.boolean(),
  /** Mileage cost as string */
  mileageCost: z.string(),
  /** Mileage cost as number */
  mileageCostRaw: z.number(),
  /** Mileage cost for direct flights only */
  directMileageCost: z.number(),
  /** Raw mileage cost for direct flights */
  directMileageCostRaw: z.number(),
  /** Total taxes and fees */
  totalTaxes: z.number(),
  /** Raw total taxes */
  totalTaxesRaw: z.number(),
  /** Total taxes for direct flights */
  directTotalTaxes: z.number(),
  /** Raw total taxes for direct flights */
  directTotalTaxesRaw: z.number(),
  /** Number of remaining award seats */
  remainingSeats: z.number(),
  /** Raw remaining seats count */
  remainingSeatsRaw: z.number(),
  /** Remaining seats on direct flights */
  directRemainingSeats: z.number(),
  /** Raw remaining seats on direct flights */
  directRemainingSeatsRaw: z.number(),
  /** Operating airline codes (comma-separated) */
  airlines: z.string(),
  /** Raw airline codes */
  airlinesRaw: z.string(),
  /** Airline codes for direct flights */
  directAirlines: z.string(),
  /** Raw airline codes for direct flights */
  directAirlinesRaw: z.string(),
  /** Whether direct flights are available */
  direct: z.boolean(),
  /** Raw direct flight availability */
  directRaw: z.boolean(),
});

export type CabinAvailability = z.infer<typeof CabinAvailabilitySchema>;
