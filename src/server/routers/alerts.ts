import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  createFlightAlert,
  deleteFlightAlert,
  getUserAlerts,
} from "@/core/alerts-service";
import { AlertNotFoundError, AlertValidationError } from "@/core/errors";
import { AlertFiltersSchema } from "@/core/filters";
import { AlertTypeSchema } from "@/core/types";

import { publicProcedure, router } from "../trpc";

const CreateAlertInput = z.object({
  type: AlertTypeSchema,
  filters: AlertFiltersSchema,
  alertEnd: z.string().optional(),
});

export const alertsRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
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
      return await getUserAlerts(user.id, "active");
    } catch (err) {
      if (err instanceof AlertValidationError) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err.message,
        });
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to load alerts",
      });
    }
  }),
  delete: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
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
        const deleted = await deleteFlightAlert(input.id, user.id);
        if (!deleted) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Alert not found",
          });
        }

        return { success: true };
      } catch (err) {
        if (err instanceof AlertValidationError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: err.message,
          });
        }

        if (err instanceof AlertNotFoundError) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: err.message,
          });
        }

        if (err instanceof TRPCError) {
          throw err;
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete alert",
        });
      }
    }),
  create: publicProcedure
    .input(CreateAlertInput)
    .mutation(async ({ ctx, input }) => {
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
    }),
});
