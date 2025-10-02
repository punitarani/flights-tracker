import { z } from "zod";

// Airport table schema
export const airport = z.object({
  id: z.string().uuid(),
  iata: z.string().length(3),
  icao: z.string().length(4).optional().nullable(),
  name: z.string(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string(),
  // PostGIS geometry stored as WGS84 Point
  location: z
    .object({
      type: z.literal("Point"),
      coordinates: z.tuple([z.number(), z.number()]),
      crs: z.literal("EPSG:4326").optional(),
    })
    .optional()
    .nullable(),
});

// Airlines table schema
export const airline = z.object({
  id: z.string().uuid(),
  iata: z.string().length(2),
  icao: z.string().length(3).optional().nullable(),
  name: z.string(),
});

// Alerts table schema
export const alert = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  filters: z.record(z.any()).default({}),
  status: z.enum(["active", "completed", "deleted"]).default("active"),
  alert_end: z.string().datetime().optional().nullable(),
  created_at: z.string().datetime(),
});

export type Airport = z.infer<typeof airport>;
export type Airline = z.infer<typeof airline>;
export type Alert = z.infer<typeof alert>;
