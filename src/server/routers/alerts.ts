import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createFlightAlert } from "@/core/alerts-service";
import { AlertValidationError } from "@/core/errors";
import { AlertFiltersSchema } from "@/core/filters";
import { AlertTypeSchema } from "@/core/types";

import { createRouter } from "../trpc";

const CreateAlertInput = z.object({
  type: AlertTypeSchema,
  filters: AlertFiltersSchema,
  alertEnd: z.string().optional(),
});

export const alertsRouter = createRouter().mutation("create", {
  input: CreateAlertInput,
  async resolve({ ctx, input }) {
    const supabase = ctx.supabase;

    if (!supabase) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Authentication client not available",
      });
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve session",
      });
    }

    if (!user?.id) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }

    try {
      return await createFlightAlert(
        user.id,
        input.type,
        input.filters,
        input.alertEnd,
      );
    } catch (err) {
      if (err instanceof AlertValidationError) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err.message,
        });
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create alert",
      });
    }
  },
});
