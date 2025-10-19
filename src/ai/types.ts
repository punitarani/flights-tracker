import { z } from "zod";

export const PlannerMapSceneSchema = z.discriminatedUnion("mode", [
  z.object({
    view: z.enum(["map"]),
    mode: z.literal("popular"),
    data: z.object({}).nullish(),
  }),
  z.object({
    view: z.enum(["map"]),
    mode: z.literal("routes"),
    data: z.object({
      airports: z.array(z.string()),
    }),
  }),
]);
export type PlannerMapScene = z.infer<typeof PlannerMapSceneSchema>;

export const PlannerSearchSceneSchema = z.object({
  view: z.enum(["search"]),
  mode: z.enum(["flights"]),
  data: z.object({
    origin: z.array(z.string()),
    destination: z.array(z.string()),
    startDate: z.string(),
    endDate: z.string(),
    travelDate: z.string().optional(), // Optional - can search by date range only
    // Optional filters for interactive search
    adults: z.number().int().min(1).max(9).default(1).optional(),
    children: z.number().int().min(0).max(8).default(0).optional(),
    maxStops: z.enum(["any", "nonstop", "1", "2"]).default("any").optional(),
    seatType: z
      .enum(["economy", "premium", "business", "first"])
      .default("economy")
      .optional(),
    maxPrice: z.number().positive().optional(),
    airlines: z.array(z.string().length(2).toUpperCase()).optional(),
    departureTimeFrom: z.number().min(0).max(24).optional(),
    departureTimeTo: z.number().min(0).max(24).optional(),
    arrivalTimeFrom: z.number().min(0).max(24).optional(),
    arrivalTimeTo: z.number().min(0).max(24).optional(),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
    searchWindowDays: z.number().int().positive().optional(),
  }),
});
export type PlannerSearchScene = z.infer<typeof PlannerSearchSceneSchema>;

export const PlannerContextSchema = z.object({
  scene: z.discriminatedUnion("view", [
    PlannerMapSceneSchema,
    PlannerSearchSceneSchema,
  ]),
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    city: z.string(),
    state: z.string(),
    country: z.string(),
    zipCode: z.string(),
  }),
});
export type PlannerContext = z.infer<typeof PlannerContextSchema>;

/**
 * Base flight search parameters shared across tools.
 * Includes common filters for airports, passengers, and preferences.
 */
const BaseFlightSearchSchema = z.object({
  origin: z
    .array(z.string().length(3).toUpperCase())
    .min(1)
    .describe(
      "Array of 3-letter IATA airport codes for departure (e.g., ['SFO', 'OAK'])",
    ),
  destination: z
    .array(z.string().length(3).toUpperCase())
    .min(1)
    .describe(
      "Array of 3-letter IATA airport codes for arrival (e.g., ['JFK', 'LGA'])",
    ),
  adults: z
    .number()
    .int()
    .min(1)
    .max(9)
    .default(1)
    .describe("Number of adult passengers (1-9)"),
  children: z
    .number()
    .int()
    .min(0)
    .max(8)
    .default(0)
    .optional()
    .describe("Number of children (0-8)"),
  maxStops: z
    .enum(["any", "nonstop", "1", "2"])
    .default("any")
    .optional()
    .describe("Maximum number of stops: any, nonstop, 1 stop, or 2 stops"),
  seatType: z
    .enum(["economy", "premium", "business", "first"])
    .default("economy")
    .optional()
    .describe(
      "Cabin class: economy, premium economy, business, or first class",
    ),
  maxPrice: z
    .number()
    .positive()
    .optional()
    .describe("Maximum price in USD to filter results"),
  airlines: z
    .array(z.string().length(2).toUpperCase())
    .optional()
    .describe(
      "Filter by specific airlines using 2-letter codes (e.g., ['UA', 'AA', 'DL'])",
    ),
});

/**
 * Parameters for searching specific one-way flights.
 * Used by searchFlightsTool to find available flights on a specific date.
 */
export const SearchFlightsParamsSchema = BaseFlightSearchSchema.extend({
  travelDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Departure date in ISO format (YYYY-MM-DD)"),
  topN: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(5)
    .optional()
    .describe("Number of top flight results to return (1-10, default: 5)"),
});
export type SearchFlightsParams = z.infer<typeof SearchFlightsParamsSchema>;

/**
 * Parameters for searching cheapest dates to fly.
 * Used by searchDatesTool to find optimal travel dates within a range.
 */
export const SearchDatesParamsSchema = BaseFlightSearchSchema.extend({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Start of date range to search (YYYY-MM-DD)"),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("End of date range to search (YYYY-MM-DD)"),
  tripType: z
    .enum(["oneway", "roundtrip"])
    .default("oneway")
    .optional()
    .describe("Trip type: one-way or round-trip search"),
  tripDuration: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe(
      "For round trips: duration in days (e.g., 7 for a week-long trip)",
    ),
});
export type SearchDatesParams = z.infer<typeof SearchDatesParamsSchema>;

/**
 * Parameters for controlling the UI scene.
 * Used by controlSceneTool to switch between map and search views.
 */
export const ControlSceneParamsSchema = z.object({
  view: z
    .enum(["map", "search"])
    .describe("Which view to display: map or search"),
  mode: z
    .enum(["popular", "routes"])
    .optional()
    .describe(
      "Map mode: popular routes or specific airport routes (only for map view)",
    ),
  airports: z
    .array(z.string().length(3).toUpperCase())
    .optional()
    .describe(
      "For map routes mode: array of 3-letter airport codes to display connections",
    ),
  origin: z
    .array(z.string().length(3).toUpperCase())
    .optional()
    .describe("Origin airport codes for search view"),
  destination: z
    .array(z.string().length(3).toUpperCase())
    .optional()
    .describe("Destination airport codes for search view"),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Start of date range for search view (YYYY-MM-DD)"),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("End of date range for search view (YYYY-MM-DD)"),
  travelDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Specific travel date for search view (YYYY-MM-DD)"),
  // Optional filters for search view
  adults: z.number().int().min(1).max(9).optional(),
  children: z.number().int().min(0).max(8).optional(),
  maxStops: z.enum(["any", "nonstop", "1", "2"]).optional(),
  seatType: z.enum(["economy", "premium", "business", "first"]).optional(),
  maxPrice: z.number().positive().optional(),
  airlines: z.array(z.string().length(2).toUpperCase()).optional(),
  departureTimeFrom: z.number().min(0).max(24).optional(),
  departureTimeTo: z.number().min(0).max(24).optional(),
  arrivalTimeFrom: z.number().min(0).max(24).optional(),
  arrivalTimeTo: z.number().min(0).max(24).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  searchWindowDays: z.number().int().positive().optional(),
});
export type ControlSceneParams = z.infer<typeof ControlSceneParamsSchema>;
