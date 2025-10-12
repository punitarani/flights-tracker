import { z } from "zod";

/**
 * Validation schema for seats.aero search requests
 */

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const airportCodeSchema = z
  .string()
  .trim()
  .length(3, "Airport code must be 3 letters")
  .regex(/^[A-Za-z]{3}$/u, "Airport code must use only letters")
  .transform((value) => value.toUpperCase());

const isoDateSchema = z
  .string()
  .regex(ISO_DATE_REGEX, "Date must be in YYYY-MM-DD format");

/**
 * Input schema for seats.aero search
 */
export const SeatsAeroSearchInputSchema = z
  .object({
    /** Origin airport IATA code */
    originAirport: airportCodeSchema,
    /** Destination airport IATA code */
    destinationAirport: airportCodeSchema,
    /** Start date for search range */
    startDate: isoDateSchema,
    /** End date for search range */
    endDate: isoDateSchema,
    /** Use cached results if available */
    useCache: z.boolean().default(true),
  })
  .refine((data) => data.originAirport !== data.destinationAirport, {
    message: "Origin and destination must be different",
    path: ["destinationAirport"],
  })
  .refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
    message: "Start date must be before or equal to end date",
    path: ["endDate"],
  });

export type SeatsAeroSearchInput = z.infer<typeof SeatsAeroSearchInputSchema>;
