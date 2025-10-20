import { TRPCError } from "@trpc/server";

import { FlightFiltersInputSchema } from "../schemas/flight-filters";
import {
  FlightFiltersValidationError,
  FlightSearchError,
  searchCalendarPrices,
  searchFlights,
} from "../services/flights";
import { publicProcedure, router } from "../trpc";

export const flightsRouter = router({
  dates: publicProcedure
    .input(FlightFiltersInputSchema)
    .mutation(async ({ input }) => {
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
    }),
  search: publicProcedure
    .input(FlightFiltersInputSchema)
    .mutation(async ({ input }) => {
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
    }),
});
