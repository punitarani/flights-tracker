CREATE TABLE "seats_aero_availability_trip" (
	"id" text PRIMARY KEY NOT NULL,
	"search_request_id" text,
	"api_trip_id" text NOT NULL,
	"api_route_id" text,
	"api_availability_id" text,
	"origin_airport" varchar(3) NOT NULL,
	"destination_airport" varchar(3) NOT NULL,
	"travel_date" text NOT NULL,
	"flight_numbers" text NOT NULL,
	"carriers" text NOT NULL,
	"aircraft_types" jsonb,
	"departure_time" timestamp NOT NULL,
	"arrival_time" timestamp NOT NULL,
	"duration_minutes" integer NOT NULL,
	"stops" integer NOT NULL,
	"total_distance_miles" integer NOT NULL,
	"cabin_class" text NOT NULL,
	"mileage_cost" integer NOT NULL,
	"remaining_seats" integer NOT NULL,
	"total_taxes" numeric(10, 2) NOT NULL,
	"taxes_currency" varchar(3),
	"taxes_currency_symbol" varchar(10),
	"source" text NOT NULL,
	"api_created_at" timestamp NOT NULL,
	"api_updated_at" timestamp NOT NULL,
	"created_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"raw_data" jsonb NOT NULL,
	CONSTRAINT "seats_aero_availability_trip_api_trip_id_unique" UNIQUE("api_trip_id")
);
--> statement-breakpoint
CREATE TABLE "seats_aero_search_request" (
	"id" text PRIMARY KEY NOT NULL,
	"origin_airport" varchar(3) NOT NULL,
	"destination_airport" varchar(3) NOT NULL,
	"search_start_date" text NOT NULL,
	"search_end_date" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"cursor" integer,
	"has_more" boolean DEFAULT false,
	"total_count" integer DEFAULT 0,
	"processed_count" integer DEFAULT 0,
	"error_message" text,
	"created_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "seats_aero_search_request_origin_airport_destination_airport_search_start_date_search_end_date_unique" UNIQUE("origin_airport","destination_airport","search_start_date","search_end_date")
);
--> statement-breakpoint
ALTER TABLE "seats_aero_availability_trip" ADD CONSTRAINT "seats_aero_availability_trip_search_request_id_seats_aero_search_request_id_fk" FOREIGN KEY ("search_request_id") REFERENCES "public"."seats_aero_search_request"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_trips_route_date" ON "seats_aero_availability_trip" USING btree ("origin_airport","destination_airport","travel_date");--> statement-breakpoint
CREATE INDEX "idx_trips_route_date_cabin" ON "seats_aero_availability_trip" USING btree ("origin_airport","destination_airport","travel_date","cabin_class");--> statement-breakpoint
CREATE INDEX "idx_trips_departure" ON "seats_aero_availability_trip" USING btree ("departure_time");--> statement-breakpoint
CREATE INDEX "idx_trips_expires" ON "seats_aero_availability_trip" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_trips_search_request" ON "seats_aero_availability_trip" USING btree ("search_request_id");--> statement-breakpoint
CREATE INDEX "idx_search_requests_route_dates" ON "seats_aero_search_request" USING btree ("origin_airport","destination_airport","search_start_date","search_end_date");--> statement-breakpoint
CREATE INDEX "idx_search_requests_status" ON "seats_aero_search_request" USING btree ("status","expires_at");
