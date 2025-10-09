CREATE TABLE "alert_notification" (
	"id" text PRIMARY KEY NOT NULL,
	"notification_id" text NOT NULL,
	"alert_id" text NOT NULL,
	"flight_data_snapshot" jsonb,
	"generated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"sent_at" timestamp NOT NULL,
	"recipient" text NOT NULL,
	"subject" text NOT NULL,
	"status" text NOT NULL,
	"error_message" text
);
--> statement-breakpoint
ALTER TABLE "airline" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "alert" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "alert_notification" ADD CONSTRAINT "alert_notification_notification_id_notification_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notification"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_notification" ADD CONSTRAINT "alert_notification_alert_id_alert_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alert"("id") ON DELETE no action ON UPDATE no action;
