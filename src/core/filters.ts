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
