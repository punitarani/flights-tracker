import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getAvailabilityByDay,
  getAvailabilityTrips,
} from "@/core/seats-aero.db";
import { SeatsAeroSearchInputSchema } from "../schemas/seats-aero-search";
import {
  SeatsAeroSearchError,
  searchSeatsAero,
} from "../services/seats-aero-search";
import { createRouter } from "../trpc";

/**
 * tRPC router for seats.aero flight searches
 * Provides cached award flight availability data
 */
export const seatsAeroRouter = createRouter()
  .query("search", {
    input: SeatsAeroSearchInputSchema,
    async resolve({ input }) {
      try {
        return await searchSeatsAero(input);
      } catch (error) {
        if (error instanceof SeatsAeroSearchError) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message,
            cause: error.cause,
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to search flights",
          cause: error,
        });
      }
    },
  })
  .query("getAvailabilityByDay", {
    input: z.object({
      originAirport: z.string().length(3),
      destinationAirport: z.string().length(3),
      searchStartDate: z.string(),
      searchEndDate: z.string(),
      cabinClass: z
        .enum(["economy", "business", "first", "premium_economy"])
        .optional(),
      sources: z.array(z.string()).optional(),
      maxStops: z.number().int().min(0).max(10).optional(),
      directOnly: z.boolean().optional(),
    }),
    async resolve({ input }) {
      try {
        return await getAvailabilityByDay(input);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch availability by day",
          cause: error,
        });
      }
    },
  })
  .query("getTrips", {
    input: z.object({
      originAirport: z.string().length(3),
      destinationAirport: z.string().length(3),
      travelDate: z.string(),
      cabinClass: z
        .enum(["economy", "business", "first", "premium_economy"])
        .optional(),
      source: z.string().optional(),
      sources: z.array(z.string()).optional(),
      maxStops: z.number().int().min(0).max(10).optional(),
      directOnly: z.boolean().optional(),
    }),
    async resolve({ input }) {
      try {
        return await getAvailabilityTrips(input);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch trips",
          cause: error,
        });
      }
    },
  });
