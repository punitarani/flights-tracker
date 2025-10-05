import { TRPCError } from "@trpc/server";

import { FlightFiltersInputSchema } from "../schemas/flight-filters";
import {
  FlightFiltersValidationError,
  FlightSearchError,
  searchCalendarPrices,
  searchFlights,
} from "../services/flights";
import { createRouter } from "../trpc";

export const flightsRouter = createRouter()
  .mutation("dates", {
    input: FlightFiltersInputSchema,
    async resolve({ input }) {
      try {
        return await searchCalendarPrices(input);
      } catch (error) {
        if (error instanceof FlightFiltersValidationError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid flight filters",
            cause: error,
          });
        }

        if (error instanceof FlightSearchError) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message,
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to search calendar prices",
        });
      }
    },
  })
  .mutation("search", {
    input: FlightFiltersInputSchema,
    async resolve({ input }) {
      try {
        return await searchFlights(input);
      } catch (error) {
        if (error instanceof FlightFiltersValidationError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid flight filters",
            cause: error,
          });
        }

        if (error instanceof FlightSearchError) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message,
          });
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to search flights",
        });
      }
    },
  });
