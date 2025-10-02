import fs from "node:fs";
import { db, generateId } from "@/db";
import { type Airport, airport } from "@/db/schema";

const columns = [
  "id",
  "name",
  "city",
  "country",
  "iata",
  "icao",
  "latitude",
  "longitude",
  "altitude",
  "timezone",
  "dst",
  "tz",
  "type",
  "source",
];

const parseLine = (line: string): Airport | undefined => {
  const values = line
    .split(",")
    .map((value) => value.trim().replace(/^"|"$/g, ""));
  if (values.length < columns.length) return undefined;

  const record: Record<string, string | number> = {};
  columns.forEach((col, index) => {
    record[col] = values[index];
  });

  const { name, city, country, iata, icao, latitude, longitude } = record;

  if (!name || !city || !country || !iata || !icao || !latitude || !longitude) {
    return undefined;
  }

  const lat = parseFloat(latitude as string);
  const lon = parseFloat(longitude as string);

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return undefined;
  }

  return {
    id: generateId("airport"),
    iata: iata as string,
    icao: icao as string,
    name: name as string,
    city: city as string,
    country: country as string,
    location: {
      x: lat,
      y: lon,
    },
  };
};

// Read the airports.csv file
const data = fs.readFileSync("data/airports.csv", "utf-8");

// Split the data into lines
const lines = data
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line !== "");
console.log(`Processing ${lines.length} Airports`);

// Parse each line into an Airport object
const airports: Airport[] = lines
  .map(parseLine)
  .filter((airport): airport is Airport => airport !== undefined);
console.log(`Parsed ${airports.length} valid Airports`);

// Write the parsed data to the db
const inserted = await db.insert(airport).values(airports).returning();
console.log(`Inserted ${inserted.length} Airports`);

// Exit the process
process.exit(0);
