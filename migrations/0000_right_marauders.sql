CREATE EXTENSION postgis;
--> statement-breakpoint
CREATE TABLE "airline" (
	"id" uuid PRIMARY KEY NOT NULL,
	"iata" varchar(2) NOT NULL,
	"icao" varchar(3) NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "airport" (
	"id" text PRIMARY KEY NOT NULL,
	"iata" varchar(3) NOT NULL,
	"icao" varchar(4) NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"country" text NOT NULL,
	"location" geometry(point) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"filters" jsonb NOT NULL,
	"status" text NOT NULL,
	"alert_end" timestamp,
	"created_at" timestamp NOT NULL
);
