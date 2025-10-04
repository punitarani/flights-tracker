import { z } from "zod";
import { AlertFiltersSchema } from "./filters";

/**
 * Schema for creating a new alert
 */
export const CreateAlertInputSchema = z.object({
  userId: z.string().min(1),
  filters: AlertFiltersSchema,
  alertEnd: z.string().optional(),
});
export type CreateAlertInput = z.infer<typeof CreateAlertInputSchema>;

/**
 * Schema for updating an existing alert
 */
export const UpdateAlertInputSchema = z.object({
  status: z.enum(["active", "completed", "deleted"]).optional(),
  alertEnd: z.string().optional(),
});
export type UpdateAlertInput = z.infer<typeof UpdateAlertInputSchema>;

/**
 * Alert status enum
 */
export const AlertStatusSchema = z.enum(["active", "completed", "deleted"]);
export type AlertStatus = z.infer<typeof AlertStatusSchema>;
