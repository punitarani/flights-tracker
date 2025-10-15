/**
 * Models for interacting with Google Flights API.
 *
 * This module contains all the data models used for flight searches and results.
 * Models are designed to match Google Flights' APIs while providing a clean TypeScript interface.
 */

import { z } from "zod";
import { Airline } from "../airline";
import { Airport } from "../airport";

/**
 * Available cabin classes for flights.
 */
export enum SeatType {
  ECONOMY = 1,
  PREMIUM_ECONOMY = 2,
  BUSINESS = 3,
  FIRST = 4,
}

/**
 * Available sorting options for flight results.
 */
export enum SortBy {
  NONE = 0,
  TOP_FLIGHTS = 1,
  CHEAPEST = 2,
  DEPARTURE_TIME = 3,
  ARRIVAL_TIME = 4,
  DURATION = 5,
}

/**
 * Type of flight journey.
 */
export enum TripType {
  ROUND_TRIP = 1,
  ONE_WAY = 2,
  // Currently not supported - kept for reference
  // MULTI_CITY = 3,
}

/**
 * Maximum number of stops allowed in flight search.
 */
export enum MaxStops {
  ANY = 0,
  NON_STOP = 1,
  ONE_STOP_OR_FEWER = 2,
  TWO_OR_FEWER_STOPS = 3,
}

/**
 * Supported currencies for pricing. Currently only USD.
 */
export enum Currency {
  USD = "USD",
}

/**
 * Time constraints for flight departure and arrival in local time.
 * All times are in hours from midnight (e.g., 20 = 8:00 PM).
 */
export const TimeRestrictionsSchema = z
  .object({
    earliestDeparture: z.number().int().min(0).max(24).optional(),
    latestDeparture: z.number().int().min(0).max(24).optional(),
    earliestArrival: z.number().int().min(0).max(24).optional(),
    latestArrival: z.number().int().min(0).max(24).optional(),
  })
  .refine(
    (data) => {
      // Validate that earliest is before latest for departure
      if (
        data.earliestDeparture !== undefined &&
        data.latestDeparture !== undefined
      ) {
        if (data.earliestDeparture > data.latestDeparture) {
          // Swap values
          const temp = data.latestDeparture;
          data.latestDeparture = data.earliestDeparture;
          data.earliestDeparture = temp;
        }
      }
      // Validate that earliest is before latest for arrival
      if (
        data.earliestArrival !== undefined &&
        data.latestArrival !== undefined
      ) {
        if (data.earliestArrival > data.latestArrival) {
          // Swap values
          const temp = data.latestArrival;
          data.latestArrival = data.earliestArrival;
          data.earliestArrival = temp;
        }
      }
      return true;
    },
    { message: "Invalid time restrictions" },
  );

export type TimeRestrictions = z.infer<typeof TimeRestrictionsSchema>;

/**
 * Passenger configuration for flight search.
 */
export const PassengerInfoSchema = z.object({
  adults: z.number().int().min(0).default(1),
  children: z.number().int().min(0).default(0),
  infantsInSeat: z.number().int().min(0).default(0),
  infantsOnLap: z.number().int().min(0).default(0),
});

export type PassengerInfo = z.infer<typeof PassengerInfoSchema>;

/**
 * Maximum price constraint for flight search.
 */
export const PriceLimitSchema = z.object({
  maxPrice: z.number().positive(),
  currency: z.enum(Currency).optional().default(Currency.USD),
});

export type PriceLimit = z.infer<typeof PriceLimitSchema>;

/**
 * Constraints for layovers in multi-leg flights.
 */
export const LayoverRestrictionsSchema = z.object({
  airports: z.array(z.enum(Airport)).optional(),
  maxDuration: z.number().positive().optional(),
});

export type LayoverRestrictions = z.infer<typeof LayoverRestrictionsSchema>;

/**
 * A single flight leg (segment) with airline and timing details.
 */
export const FlightLegSchema = z.object({
  airline: z.enum(Airline),
  flightNumber: z.string(),
  departureAirport: z.enum(Airport),
  arrivalAirport: z.enum(Airport),
  departureDateTime: z.date(),
  arrivalDateTime: z.date(),
  duration: z.number().positive(), // in minutes
});

export type FlightLeg = z.infer<typeof FlightLegSchema>;

/**
 * Complete flight search result with pricing and timing.
 */
export const FlightResultSchema = z.object({
  legs: z.array(FlightLegSchema),
  price: z.number().min(0), // in specified currency
  duration: z.number().positive(), // total duration in minutes
  stops: z.number().int().min(0),
});

export type FlightResult = z.infer<typeof FlightResultSchema>;

/**
 * A segment represents a single portion of a flight journey between two airports.
 *
 * For example, in a one-way flight from JFK to LAX, there would be one segment.
 * In a multi-city trip from JFK -> LAX -> SEA, there would be two segments:
 * JFK -> LAX and LAX -> SEA.
 */
export const FlightSegmentSchema = z
  .object({
    departureAirport: z.array(z.array(z.union([z.enum(Airport), z.number()]))),
    arrivalAirport: z.array(z.array(z.union([z.enum(Airport), z.number()]))),
    travelDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    timeRestrictions: TimeRestrictionsSchema.optional(),
    selectedFlight: FlightResultSchema.optional(),
  })
  .refine(
    (data) => {
      // Validate that travel date is not in the past
      const travelDate = new Date(data.travelDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return travelDate >= today;
    },
    { message: "Travel date cannot be in the past" },
  )
  .refine(
    (data) => {
      // Validate that departure and arrival airports are different
      if (!data.departureAirport.length || !data.arrivalAirport.length) {
        return false;
      }
      const depAirport = data.departureAirport[0][0];
      const arrAirport = data.arrivalAirport[0][0];
      return depAirport !== arrAirport;
    },
    { message: "Departure and arrival airports must be different" },
  );

export type FlightSegment = z.infer<typeof FlightSegmentSchema>;
