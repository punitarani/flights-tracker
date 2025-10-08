import {
  geometry,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { AlertType } from "@/core/alert-types";
import type { AlertFilters } from "@/core/filters";
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
  country: text("country").notNull(),
  location: geometry("location", {
    type: "point",
    mode: "xy",
    srid: 4326,
  }).notNull(),
});

export const airline = pgTable("airline", {
  id: text("id")
    .primaryKey()
    .notNull()
    .$defaultFn(() => generateId("airline")),
  iata: varchar("iata", { length: 2 }).notNull(),
  icao: varchar("icao", { length: 3 }).notNull(),
  name: text("name").notNull(),
});

export const alert = pgTable("alert", {
  id: text("id")
    .primaryKey()
    .notNull()
    .$defaultFn(() => generateId("alert")),
  userId: uuid("user_id").notNull(),
  type: text("type").notNull().$type<AlertType>(),
  filters: jsonb("filters").notNull().$type<AlertFilters>(),
  status: text("status").$type<"active" | "completed" | "deleted">().notNull(),
  alertEnd: timestamp("alert_end", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).notNull(),
});

export const notification = pgTable("notification", {
  id: text("id")
    .primaryKey()
    .notNull()
    .$defaultFn(() => generateId("notification")),
  userId: uuid("user_id").notNull(),
  type: text("type").notNull().$type<"daily" | "price-drop">(),
  sentAt: timestamp("sent_at", { mode: "string" }).notNull(),
  recipient: text("recipient").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull().$type<"sent" | "failed">(),
  errorMessage: text("error_message"),
});

export const alertNotification = pgTable("alert_notification", {
  id: text("id")
    .primaryKey()
    .notNull()
    .$defaultFn(() => generateId("alertNotification")),
  notificationId: text("notification_id")
    .notNull()
    .references(() => notification.id),
  alertId: text("alert_id")
    .notNull()
    .references(() => alert.id),
  flightDataSnapshot: jsonb("flight_data_snapshot").$type<
    import("@/server/services/flights").FlightOption[]
  >(),
  generatedAt: timestamp("generated_at", { mode: "string" }).notNull(),
});

export type Airport = typeof airport.$inferSelect;
export type Airline = typeof airline.$inferSelect;
export type Alert = typeof alert.$inferSelect;
export type Notification = typeof notification.$inferSelect;
export type AlertNotification = typeof alertNotification.$inferSelect;
