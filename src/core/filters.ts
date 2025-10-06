import { z } from "zod";

export const Stops = z.enum(["ANY", "NONSTOP", "ONE_STOP", "TWO_STOPS"]);
export type Stops = z.infer<typeof Stops>;

export const SeatClass = z.enum([
  "ECONOMY",
  "PREMIUM_ECONOMY",
  "BUSINESS",
  "FIRST",
]);
export type SeatClass = z.infer<typeof SeatClass>;

export const AlertRouteSchema = z.object({
  from: z.string().length(3),
  to: z.string().length(3),
});
export type AlertRoute = z.infer<typeof AlertRouteSchema>;

const AlertTimeRangeSchema = z
  .object({
    from: z
      .number({ error: "Time range 'from' must be a number" })
      .min(0, "Time range start must be at least 0")
      .max(24, "Time range start cannot exceed 24")
      .optional(),
    to: z
      .number({ error: "Time range 'to' must be a number" })
      .min(0, "Time range end must be at least 0")
      .max(24, "Time range end cannot exceed 24")
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.from === undefined && value.to === undefined) {
      ctx.addIssue({
        code: "custom" as const,
        message: "Time range requires at least one bound",
      });
      return;
    }

    if (
      value.from !== undefined &&
      value.to !== undefined &&
      value.from > value.to
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Time range start must be less than or equal to end",
      });
    }
  });
export type AlertTimeRange = z.infer<typeof AlertTimeRangeSchema>;

export const AlertFilterCriteriaSchema = z.object({
  dateFrom: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
    .optional(),
  dateTo: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
    .optional(),
  stops: Stops.optional(),
  class: SeatClass.optional(),
  airlines: z.array(z.string().length(2)).optional(),
  price: z.number().int().positive().optional(),
  departureTimeRange: AlertTimeRangeSchema.optional(),
  arrivalTimeRange: AlertTimeRangeSchema.optional(),
});
export type AlertFilterCriteria = z.infer<typeof AlertFilterCriteriaSchema>;

export const AlertFiltersV1Schema = z.object({
  version: z.literal(1),
  route: AlertRouteSchema,
  filters: AlertFilterCriteriaSchema.default({}),
});
export type AlertFiltersV1 = z.infer<typeof AlertFiltersV1Schema>;

export const AlertFiltersSchema = z.discriminatedUnion("version", [
  AlertFiltersV1Schema,
]);
export type AlertFilters = z.infer<typeof AlertFiltersSchema>;
