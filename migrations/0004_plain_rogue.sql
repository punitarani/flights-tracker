ALTER TABLE "seats_aero_availability_trip" DROP CONSTRAINT "seats_aero_availability_trip_search_request_id_seats_aero_search_request_id_fk";
--> statement-breakpoint
DROP INDEX "idx_trips_route_date";--> statement-breakpoint
DROP INDEX "idx_trips_route_date_cabin";--> statement-breakpoint
DROP INDEX "idx_trips_departure";--> statement-breakpoint
DROP INDEX "idx_trips_expires";--> statement-breakpoint
DROP INDEX "idx_search_requests_route_dates";--> statement-breakpoint
DROP INDEX "idx_search_requests_status";--> statement-breakpoint
ALTER TABLE "seats_aero_availability_trip" DROP COLUMN "flight_numbers";--> statement-breakpoint
ALTER TABLE "seats_aero_availability_trip" ADD COLUMN "flight_numbers" text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "seats_aero_availability_trip" ADD CONSTRAINT "seats_aero_availability_trip_search_request_id_seats_aero_search_request_id_fk" FOREIGN KEY ("search_request_id") REFERENCES "public"."seats_aero_search_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_trips_route_date_created" ON "seats_aero_availability_trip" USING btree ("origin_airport","destination_airport","travel_date","created_at");--> statement-breakpoint
CREATE INDEX "idx_trips_created" ON "seats_aero_availability_trip" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_search_requests_status" ON "seats_aero_search_request" USING btree ("status","created_at");--> statement-breakpoint
ALTER TABLE "seats_aero_availability_trip" DROP COLUMN "expires_at";--> statement-breakpoint
ALTER TABLE "seats_aero_search_request" DROP COLUMN "expires_at";
