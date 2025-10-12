import {
  boolean,
  decimal,
  geometry,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { AlertType } from "@/core/alert-types";
import type { AlertFilters } from "@/core/filters";
import type { AvailabilityTrip } from "@/lib/fli/models/seats-aero";
import type { FlightOption } from "@/server/services/flights";
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
  flightDataSnapshot: jsonb("flight_data_snapshot").$type<FlightOption[]>(),
  generatedAt: timestamp("generated_at", { mode: "string" }).notNull(),
});

export const seatsAeroSearchRequest = pgTable(
  "seats_aero_search_request",
  {
    id: text("id")
      .primaryKey()
      .notNull()
      .$defaultFn(() => generateId("seatsAeroSearchRequest")),
    originAirport: varchar("origin_airport", { length: 3 }).notNull(),
    destinationAirport: varchar("destination_airport", { length: 3 }).notNull(),
    searchStartDate: text("search_start_date").notNull(),
    searchEndDate: text("search_end_date").notNull(),
    status: text("status")
      .notNull()
      .$type<"pending" | "processing" | "completed" | "failed">()
      .default("pending"),
    cursor: integer("cursor"),
    hasMore: boolean("has_more").default(false),
    totalCount: integer("total_count").default(0),
    processedCount: integer("processed_count").default(0),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { mode: "string" })
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    completedAt: timestamp("completed_at", { mode: "string" }),
    expiresAt: timestamp("expires_at", { mode: "string" }).notNull(),
  },
  (table) => ({
    uniqueSearch: unique().on(
      table.originAirport,
      table.destinationAirport,
      table.searchStartDate,
      table.searchEndDate,
    ),
    routeDatesIdx: index("idx_search_requests_route_dates").on(
      table.originAirport,
      table.destinationAirport,
      table.searchStartDate,
      table.searchEndDate,
    ),
    statusIdx: index("idx_search_requests_status").on(
      table.status,
      table.expiresAt,
    ),
  }),
);

export const seatsAeroAvailabilityTrip = pgTable(
  "seats_aero_availability_trip",
  {
    id: text("id")
      .primaryKey()
      .notNull()
      .$defaultFn(() => generateId("seatsAeroAvailabilityTrip")),
    searchRequestId: text("search_request_id").references(
      () => seatsAeroSearchRequest.id,
      { onDelete: "set null" },
    ),

    // API identifiers
    apiTripId: text("api_trip_id").notNull().unique(),
    apiRouteId: text("api_route_id"),
    apiAvailabilityId: text("api_availability_id"),

    // Route information
    originAirport: varchar("origin_airport", { length: 3 }).notNull(),
    destinationAirport: varchar("destination_airport", { length: 3 }).notNull(),
    travelDate: text("travel_date").notNull(),

    // Flight details
    flightNumbers: text("flight_numbers").notNull(),
    carriers: text("carriers").notNull(),
    aircraftTypes: jsonb("aircraft_types").$type<string[] | null>(),
    departureTime: timestamp("departure_time", { mode: "string" }).notNull(),
    arrivalTime: timestamp("arrival_time", { mode: "string" }).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    stops: integer("stops").notNull(),
    totalDistanceMiles: integer("total_distance_miles").notNull(),

    // Pricing & availability
    cabinClass: text("cabin_class")
      .notNull()
      .$type<"economy" | "business" | "first" | "premium_economy">(),
    mileageCost: integer("mileage_cost").notNull(),
    remainingSeats: integer("remaining_seats").notNull(),
    totalTaxes: decimal("total_taxes", { precision: 10, scale: 2 }).notNull(),
    taxesCurrency: varchar("taxes_currency", { length: 3 }),
    taxesCurrencySymbol: varchar("taxes_currency_symbol", { length: 10 }),

    // Source program
    source: text("source").notNull(),

    // Metadata
    apiCreatedAt: timestamp("api_created_at", { mode: "string" }).notNull(),
    apiUpdatedAt: timestamp("api_updated_at", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    expiresAt: timestamp("expires_at", { mode: "string" }).notNull(),
    rawData: jsonb("raw_data").notNull().$type<AvailabilityTrip>(),
  },
  (table) => [
    index("idx_trips_route_date").on(
      table.originAirport,
      table.destinationAirport,
      table.travelDate,
    ),
    index("idx_trips_route_date_cabin").on(
      table.originAirport,
      table.destinationAirport,
      table.travelDate,
      table.cabinClass,
    ),
    index("idx_trips_departure").on(table.departureTime),
    index("idx_trips_expires").on(table.expiresAt),
    index("idx_trips_search_request").on(table.searchRequestId),
  ],
);

export type Airport = typeof airport.$inferSelect;
export type Airline = typeof airline.$inferSelect;
export type Alert = typeof alert.$inferSelect;
export type Notification = typeof notification.$inferSelect;
export type AlertNotification = typeof alertNotification.$inferSelect;
export type SeatsAeroSearchRequest = typeof seatsAeroSearchRequest.$inferSelect;
export type SeatsAeroAvailabilityTrip =
  typeof seatsAeroAvailabilityTrip.$inferSelect;
