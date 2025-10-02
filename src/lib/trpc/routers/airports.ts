import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { publicProcedure, router } from "../trpc";

export interface AirportData {
  id: string;
  name: string;
  city: string;
  country: string;
  iata: string;
  icao: string;
  latitude: number;
  longitude: number;
}

// Cache the parsed airports data
let cachedAirports: AirportData[] | null = null;

function loadAirports(): AirportData[] {
  if (cachedAirports) {
    return cachedAirports;
  }

  const csvPath = path.join(process.cwd(), "data", "airports.csv");
  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const lines = csvContent.trim().split("\n");

  cachedAirports = lines
    .map((line) => {
      // Parse CSV line (handling quoted fields)
      const matches = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
      if (!matches || matches.length < 6) return null;

      const id = matches[0]?.replace(/"/g, "").trim();
      const name = matches[1]?.replace(/"/g, "").trim();
      const city = matches[2]?.replace(/"/g, "").trim();
      const country = matches[3]?.replace(/"/g, "").trim();
      const iata = matches[4]?.replace(/"/g, "").trim();
      const icao = matches[5]?.replace(/"/g, "").trim();
      const latitude = Number.parseFloat(
        matches[6]?.replace(/"/g, "").trim() || "0",
      );
      const longitude = Number.parseFloat(
        matches[7]?.replace(/"/g, "").trim() || "0",
      );

      // Filter out invalid entries
      if (
        !name ||
        !iata ||
        !icao ||
        Number.isNaN(latitude) ||
        Number.isNaN(longitude)
      ) {
        return null;
      }

      return {
        id,
        name,
        city,
        country,
        iata,
        icao,
        latitude,
        longitude,
      };
    })
    .filter((airport): airport is AirportData => airport !== null);

  return cachedAirports;
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  // Haversine formula to calculate distance in miles
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const airportsRouter = router({
  getAirports: publicProcedure
    .input(
      z.object({
        query: z.string().optional(),
        lat: z.number().optional(),
        lon: z.number().optional(),
        radius: z.number().optional(),
        limit: z.number().min(1).max(10000).default(10000),
      }),
    )
    .query(({ input }) => {
      let airports = loadAirports();

      // Apply search filter
      if (input.query) {
        const query = input.query.toLowerCase();
        airports = airports.filter(
          (airport) =>
            airport.name.toLowerCase().includes(query) ||
            airport.iata.toLowerCase().includes(query) ||
            airport.icao.toLowerCase().includes(query) ||
            airport.city.toLowerCase().includes(query) ||
            airport.country.toLowerCase().includes(query),
        );
      }

      // Apply radius filter
      if (input.lat && input.lon && input.radius) {
        const { lat, lon, radius } = input;
        airports = airports.filter((airport) => {
          const distance = calculateDistance(
            lat,
            lon,
            airport.latitude,
            airport.longitude,
          );
          return distance <= radius;
        });
      }

      // Limit results for performance
      const limitedAirports = airports.slice(0, input.limit);

      return {
        airports: limitedAirports,
        total: airports.length,
        returned: limitedAirports.length,
      };
    }),

  getAirportById: publicProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(({ input }) => {
      const airports = loadAirports();
      const airport = airports.find(
        (a) => a.id === input.id || a.iata === input.id || a.icao === input.id,
      );

      if (!airport) {
        throw new Error("Airport not found");
      }

      return airport;
    }),
});
