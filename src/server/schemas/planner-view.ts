import { z } from "zod";

/**
 * Schema for route data displayed on map
 */
export const RouteDataSchema = z.object({
  origin: z.object({
    code: z.string(),
    city: z.string(),
    country: z.string(),
    lat: z.number(),
    lon: z.number(),
  }),
  destination: z.object({
    code: z.string(),
    city: z.string(),
    country: z.string(),
    lat: z.number(),
    lon: z.number(),
  }),
  distanceMiles: z.number().optional(),
});

export type RouteData = z.infer<typeof RouteDataSchema>;

/**
 * Map View Schemas
 */
export const MapViewPopularSchema = z.object({
  mode: z.literal("map"),
  view: z.literal("popular"),
});

export const MapViewRouteSchema = z.object({
  mode: z.literal("map"),
  view: z.literal("route"),
  data: RouteDataSchema,
});

export const MapViewSchema = z.discriminatedUnion("view", [
  MapViewPopularSchema,
  MapViewRouteSchema,
]);

export type MapView = z.infer<typeof MapViewSchema>;

/**
 * Search View Schema
 */
export const SearchViewSchema = z.object({
  mode: z.literal("search"),
  route: RouteDataSchema,
  filters: z
    .object({
      dateFrom: z.string(),
      dateTo: z.string(),
      maxPrice: z.number().optional(),
      stops: z.enum(["any", "0", "1"]).optional(),
    })
    .optional(),
  flightCount: z.number(),
});

export type SearchView = z.infer<typeof SearchViewSchema>;

/**
 * Comparison View Schema
 */
export const ComparisonViewSchema = z.object({
  mode: z.literal("comparison"),
  routes: z.array(RouteDataSchema).min(2).max(5),
  priceData: z.array(
    z.object({
      route: z.string(),
      avgPrice: z.number(),
      minPrice: z.number(),
      maxPrice: z.number(),
    }),
  ),
});

export type ComparisonView = z.infer<typeof ComparisonViewSchema>;

/**
 * Page View Schema - Discriminated Union
 * Determines what to render in the main view area
 */
export const PageViewSchema = z.discriminatedUnion("mode", [
  MapViewSchema,
  SearchViewSchema,
  ComparisonViewSchema,
]);

export type PageView = z.infer<typeof PageViewSchema>;

/**
 * Flight card data for chat UI
 */
export const FlightCardDataSchema = z.object({
  id: z.string(),
  origin: z.string(),
  destination: z.string(),
  departureDate: z.string(),
  returnDate: z.string().nullable().optional(),
  price: z.number(),
  currency: z.string(),
  stops: z.number(),
  duration: z.number(),
  airlines: z.array(z.string()),
  departureTime: z.string().optional(),
  arrivalTime: z.string().optional(),
});

export type FlightCardData = z.infer<typeof FlightCardDataSchema>;

/**
 * Price chart data for visualization
 */
export const PriceChartDataSchema = z.object({
  route: z.string(),
  data: z.array(
    z.object({
      date: z.string(),
      price: z.number(),
    }),
  ),
  currency: z.string(),
  cheapestDate: z.string().optional(),
});

export type PriceChartData = z.infer<typeof PriceChartDataSchema>;

/**
 * Comparison table data
 */
export const ComparisonTableDataSchema = z.object({
  routes: z.array(
    z.object({
      origin: z.string(),
      destination: z.string(),
      cheapestPrice: z.number(),
      avgPrice: z.number(),
      bestDate: z.string(),
      stops: z.number(),
      airlines: z.array(z.string()),
    }),
  ),
});

export type ComparisonTableData = z.infer<typeof ComparisonTableDataSchema>;

/**
 * Route summary data
 */
export const RouteSummaryDataSchema = z.object({
  origin: z.string(),
  destination: z.string(),
  distance: z.number().optional(),
  avgPrice: z.number().optional(),
  cheapestDate: z.string().optional(),
  popularAirlines: z.array(z.string()).optional(),
});

export type RouteSummaryData = z.infer<typeof RouteSummaryDataSchema>;

/**
 * UI Component Types for Chat Messages
 */
export const ChatUIComponentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("flightCards"),
    data: z.array(FlightCardDataSchema),
  }),
  z.object({
    type: z.literal("priceChart"),
    data: PriceChartDataSchema,
  }),
  z.object({
    type: z.literal("comparisonTable"),
    data: ComparisonTableDataSchema,
  }),
  z.object({
    type: z.literal("routeSummary"),
    data: RouteSummaryDataSchema,
  }),
]);

export type ChatUIComponent = z.infer<typeof ChatUIComponentSchema>;

/**
 * Chat Message Content
 */
export const ChatMessageContentSchema = z.object({
  text: z.string(),
  uiComponents: z.array(ChatUIComponentSchema).optional(),
  pageView: PageViewSchema.optional(),
});

export type ChatMessageContent = z.infer<typeof ChatMessageContentSchema>;
