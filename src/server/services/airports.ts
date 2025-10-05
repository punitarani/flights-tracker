import fs from "node:fs";
import path from "node:path";

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

export interface SearchAirportsParams {
  query?: string;
  lat?: number;
  lon?: number;
  radius?: number;
  limit?: number;
}

export interface SearchAirportsResult {
  airports: AirportData[];
  total: number;
  returned: number;
}

const CSV_PATH = path.join(process.cwd(), "data", "airports.csv");
let cachedAirports: AirportData[] | null = null;

function parseAirportLine(line: string): AirportData | null {
  const matches = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
  if (!matches || matches.length < 8) return null;

  const id = matches[0]?.replace(/"/g, "").trim();
  const name = matches[1]?.replace(/"/g, "").trim();
  const city = matches[2]?.replace(/"/g, "").trim() ?? "";
  const country = matches[3]?.replace(/"/g, "").trim() ?? "";
  const iata = matches[4]?.replace(/"/g, "").trim();
  const icao = matches[5]?.replace(/"/g, "").trim();
  const latitude = Number.parseFloat(
    matches[6]?.replace(/"/g, "").trim() || "0",
  );
  const longitude = Number.parseFloat(
    matches[7]?.replace(/"/g, "").trim() || "0",
  );

  if (
    !id ||
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
}

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const R = 3959;
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

export function loadAirports(): AirportData[] {
  if (cachedAirports) {
    return cachedAirports;
  }

  const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
  const lines = csvContent.trim().split("\n");

  cachedAirports = lines
    .map(parseAirportLine)
    .filter((airport): airport is AirportData => airport !== null);

  return cachedAirports;
}

export function searchAirports(
  params: SearchAirportsParams = {},
): SearchAirportsResult {
  const airports = loadAirports();

  const normalizedQuery = params.query?.trim().toLowerCase();

  let filteredAirports = airports;

  if (normalizedQuery) {
    const query = normalizedQuery;
    filteredAirports = filteredAirports.filter(
      (airport) =>
        airport.name.toLowerCase().includes(query) ||
        airport.iata.toLowerCase().includes(query) ||
        airport.icao.toLowerCase().includes(query) ||
        airport.city.toLowerCase().includes(query) ||
        airport.country.toLowerCase().includes(query),
    );
  }

  const { lat, lon, radius } = params;
  if (
    typeof lat === "number" &&
    Number.isFinite(lat) &&
    typeof lon === "number" &&
    Number.isFinite(lon) &&
    typeof radius === "number" &&
    Number.isFinite(radius)
  ) {
    filteredAirports = filteredAirports.filter((airport) => {
      const distance = calculateDistance(
        lat,
        lon,
        airport.latitude,
        airport.longitude,
      );
      return distance <= radius;
    });
  }

  const total = filteredAirports.length;
  const limit = Math.max(1, Math.min(params.limit ?? 10000, 20000));
  const limitedAirports = filteredAirports.slice(0, limit);

  return {
    airports: limitedAirports,
    total,
    returned: limitedAirports.length,
  };
}

export function clearAirportsCache() {
  cachedAirports = null;
}
