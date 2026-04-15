-- Enable Row-Level Security on all tables.
--
-- Application reads/writes go through Drizzle over a direct Postgres
-- connection using a privileged role (which bypasses RLS), and the
-- Cloudflare workers use the Supabase service role key. Both paths are
-- unaffected by RLS.
--
-- Enabling RLS here closes off direct access via the Supabase
-- PostgREST/Data APIs for the `anon` and `authenticated` roles. With RLS
-- enabled and no permissive policies defined, all access through those
-- roles is denied by default, so tables are not readable or writable by
-- arbitrary clients holding only the publishable/anon key.
--
-- FORCE ROW LEVEL SECURITY additionally ensures the table owner is also
-- subject to policies, preventing accidental data exposure if the
-- application ever connects under the owner role through PostgREST.

ALTER TABLE "airport" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "airport" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "airline" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "airline" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "alert" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "alert" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "notification" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notification" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "alert_notification" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "alert_notification" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "seats_aero_search_request" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "seats_aero_search_request" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "seats_aero_availability_trip" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "seats_aero_availability_trip" FORCE ROW LEVEL SECURITY;
