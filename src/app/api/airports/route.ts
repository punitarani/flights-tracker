import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.toLowerCase();
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");
    const radius = searchParams.get("radius");

    let airports = loadAirports();

    // Apply search filter
    if (query) {
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
    if (lat && lon && radius) {
      const centerLat = Number.parseFloat(lat);
      const centerLon = Number.parseFloat(lon);
      const radiusMiles = Number.parseFloat(radius);

      if (
        !Number.isNaN(centerLat) &&
        !Number.isNaN(centerLon) &&
        !Number.isNaN(radiusMiles)
      ) {
        airports = airports.filter((airport) => {
          const distance = calculateDistance(
            centerLat,
            centerLon,
            airport.latitude,
            airport.longitude,
          );
          return distance <= radiusMiles;
        });
      }
    }

    // Limit results for performance
    const limitedAirports = airports.slice(0, 10000);

    return NextResponse.json({
      airports: limitedAirports,
      total: airports.length,
      returned: limitedAirports.length,
    });
  } catch (error) {
    console.error("Error loading airports:", error);
    return NextResponse.json(
      { error: "Failed to load airports" },
      { status: 500 },
    );
  }
}
