import {
  geometry,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { generateId } from "./id";

export const airport = pgTable("airport", {
  id: text("id")
    .primaryKey()
    .notNull()
    .$defaultFn(() => generateId("airport")),
  iata: varchar("iata", { length: 3 }).notNull(),
  icao: varchar("icao", { length: 4 }).notNull(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  country: text("country").notNull(),
  location: geometry("location", {
    type: "point",
    mode: "xy",
    srid: 4326,
  }).notNull(),
});

export const airline = pgTable("airline", {
  id: uuid("id")
    .primaryKey()
    .notNull()
    .$defaultFn(() => generateId("airline")),
  iata: varchar("iata", { length: 2 }).notNull(),
  icao: varchar("icao", { length: 3 }).notNull(),
  name: text("name").notNull(),
});

export const alert = pgTable("alert", {
  id: uuid("id")
    .primaryKey()
    .notNull()
    .$defaultFn(() => generateId("alert")),
  userId: uuid("user_id").notNull(),
  filters: jsonb("filters").notNull(),
  status: text("status").$type<"active" | "completed" | "deleted">().notNull(),
  alertEnd: timestamp("alert_end", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).notNull(),
});

export type Airport = typeof airport.$inferSelect;
export type Airline = typeof airline.$inferSelect;
export type Alert = typeof alert.$inferSelect;
