import { z } from "zod";
import { searchAirports } from "../services/airports";
import { createRouter } from "../trpc";

const searchInputSchema = z
  .object({
    q: z.string().trim().min(1).max(100).optional(),
    lat: z.number().finite().optional(),
    lon: z.number().finite().optional(),
    radius: z.number().positive().finite().optional(),
    limit: z.number().int().positive().max(10000).optional(),
  })
  .refine(
    (value) => {
      const hasLat = typeof value.lat === "number";
      const hasLon = typeof value.lon === "number";
      const hasRadius = typeof value.radius === "number";
      return (
        (hasLat && hasLon && hasRadius) || (!hasLat && !hasLon && !hasRadius)
      );
    },
    {
      message: "lat, lon, and radius must be provided together",
      path: ["lat"],
    },
  );

export const airportsRouter = createRouter().query("search", {
  input: searchInputSchema,
  resolve({ input }) {
    return searchAirports({
      query: input?.q,
      lat: input?.lat,
      lon: input?.lon,
      radius: input?.radius,
      limit: input?.limit,
    });
  },
});
