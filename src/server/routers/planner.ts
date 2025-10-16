import { TRPCError } from "@trpc/server";
import { PlanItineraryInputSchema } from "../schemas/planner";
import { planItinerary } from "../services/planner-agent";
import { createRouter } from "../trpc";

/**
 * Planner router using AI SDK with streaming RSCs
 * The planItinerary function returns React Server Components
 * that can be streamed to the client for real-time updates
 */
export const plannerRouter = createRouter().mutation("plan", {
  input: PlanItineraryInputSchema,
  async resolve({ input }) {
    try {
      const result = await planItinerary(input);
      return result;
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
