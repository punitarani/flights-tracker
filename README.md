# Fli – Flights Tracker

Flights Tracker helps travelers check available flights, monitor price trends, plan upcoming trips, and create personalized alerts. The application is built with Next.js 15, React 19, Supabase authentication, a PostgreSQL database via Drizzle ORM, Apple MapKit visualizations, Tailwind CSS, and TypeScript.

## Key Features

* Search for flights and review route availability in real time.
* Track fare changes and set alert thresholds for routes of interest.
* Plan itineraries with Supabase-backed user dashboards.
* Create, edit, and manage alert rules with validation safeguards.
* Explore airports with Apple MapKit maps and responsive Tailwind UI components.

## Tech Stack

* **Frontend:** Next.js 15, React 19, Tailwind CSS, Radix UI primitives, next-themes, Sonner.
* **Backend:** Next.js Server Actions, Supabase SSR client, Drizzle ORM.
* **Database:** PostgreSQL with prefixed ULID identifiers.
* **Tooling:** TypeScript, Vitest with happy-dom, Biome formatter/linter, Bun runtime.

## Prerequisites

* Install [Bun](https://bun.sh/) for dependency management and scripts.
* Copy `.env.example` to `.env.local` and populate the required variables validated by `@t3-oss/env-nextjs`.

## Getting Started

1. Install dependencies: `bun install`
2. Run the development server: `bun run dev`
3. Open `http://localhost:3000` to use Flights Tracker.

## Available Scripts

* `bun run dev` – Start the Turbopack development server.
* `bun run build` – Produce an optimized production bundle.
* `bun start` – Serve the production build.
* `bun test` – Execute all tests with Vitest.
* `bun run test:watch` – Run tests in watch mode.
* `bun run test:ui` – Launch the Vitest UI runner.
* `bun run lint` – Check code style with Biome.
* `bun run format` – Format the codebase with Biome.

## Database & Migrations

* Schema definition: `src/db/schema.ts`
* Database configuration: `drizzle.config.ts`
* Migrations directory: `./migrations`
* Commands:
  * `bun run db:generate` – Generate migration files from schema changes.
  * `bun run db:push` – Push schema updates directly to the development database.
  * `bun run db:migrate` – Apply pending migrations.
  * `bun run db:studio` – Open Drizzle Studio for database exploration.

## Architecture Overview

### Database Layer

Drizzle ORM manages PostgreSQL entities for airports, airlines, and alerts.

### Authentication & Middleware

Supabase handles authentication with SSR support. Middleware in `src/middleware.ts` to validate sessions and enforce public-route access rules.

### Business Logic

Alert-related domain logic lives in `src/core/alerts-service.ts`, `src/core/alerts-db.ts`, and versioned filter schemas in `src/core/filters.ts`.

### UI Components

Reusable components reside in `src/components/ui`, while custom features like `airport-search` and `airport-map` integrate Apple MapKit and Tailwind styling. Path alias `@/*` maps to `./src/*` for cleaner imports.

## Environment Variables

* `DATABASE_URL` – PostgreSQL connection string.
* `NEXT_PUBLIC_SUPABASE_URL` – Supabase project URL.
* `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` – Supabase anon key.
* `SUPABASE_SECRET_KEY` – Supabase service role key.
* `NEXT_PUBLIC_MAPKIT_TOKEN` – Apple MapKit JS token.

## Testing Notes

Tests run with Vitest in a happy-dom environment. Global setup, mocks, and database stubs are configured in `src/test-setup.ts`.
