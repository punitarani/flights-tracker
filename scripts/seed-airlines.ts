import fs from "node:fs";
import { db, generateId } from "@/db";
import { type Airline, airline } from "@/db/schema";

const columns = [
  "id",
  "name",
  "alias",
  "iata",
  "icao",
  "callsign",
  "country",
  "active",
];

const parseLine = (line: string): Airline | undefined => {
  const values = line
    .split(",")
    .map((value) => value.trim().replace(/^"|"$/g, ""));
  if (values.length < columns.length) return undefined;

  const record: Record<string, string> = {};
  columns.forEach((col, index) => {
    record[col] = values[index];
  });

  const { name, iata, icao } = record;

  // Only seed airlines with valid codes
  if (!name || !iata || !icao || iata.length !== 2 || icao.length !== 3) {
    return undefined;
  }

  return {
    id: generateId("airline"),
    iata: iata,
    icao: icao,
    name: name,
  };
};

// Read the airlines.csv file
const data = fs.readFileSync("data/airlines.csv", "utf-8");

// Split the data into lines
const lines = data
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line !== "");
console.log(`Processing ${lines.length} Airlines`);

// Parse each line into an Airline object
const airlines: Airline[] = lines
  .map(parseLine)
  .filter((airline): airline is Airline => airline !== undefined);
console.log(`Parsed ${airlines.length} valid Airlines`);

// Write the parsed data to the db
const inserted = await db.insert(airline).values(airlines).returning();
console.log(`Inserted ${inserted.length} Airlines`);

// Exit the process
process.exit(0);
