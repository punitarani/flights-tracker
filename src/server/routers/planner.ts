import { TRPCError } from "@trpc/server";
import { PlanItineraryInputSchema } from "../schemas/planner";
import { planItinerary } from "../services/planner-agent";
import { createRouter } from "../trpc";

export const plannerRouter = createRouter().mutation("plan", {
  input: PlanItineraryInputSchema,
  async resolve({ input }) {
    try {
      return await planItinerary(input);
    } catch (error) {
      if (error instanceof Error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
          cause: error,
        });
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to plan itinerary",
      });
    }
  },
});
