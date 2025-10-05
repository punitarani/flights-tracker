# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js 15 application for tracking flight alerts with Supabase authentication, PostgreSQL database (via Drizzle ORM), and Apple MapKit integration. Built with React 19, TypeScript, and Tailwind CSS.

## Development Commands

### Running the Application

* `bun run dev` - Start development server with Turbopack
* `bun run build` - Build production bundle with Turbopack
* `bun start` - Start production server

### Testing

* `bun test` - Run all tests with Vitest
* `bun run test:watch` - Run tests in watch mode
* `bun run test:ui` - Launch Vitest UI for interactive test running
* Test files: `*.test.ts` files alongside source code
* Test setup: `src/test-setup.ts` (mocks env, db client, console)
* Uses `happy-dom` environment for DOM testing

### Code Quality

* `bun run lint` - Run Biome linter and auto-fix issues (with --unsafe flag)
* `bun run format` - Format code with Biome

### Database (Drizzle ORM)

* `bun run db:generate` - Generate migration files from schema changes
* `bun run db:push` - Push schema changes directly to database (development)
* `bun run db:studio` - Launch Drizzle Studio database GUI
* `bun run db:migrate` - Run pending migrations
* Schema: `src/db/schema.ts`
* Config: `drizzle.config.ts`
* Migrations directory: `./migrations`

## Architecture

### Database Layer

* **ORM**: Drizzle with PostgreSQL (postgres.js driver)
* **Client**: `src/db/client.ts` - Single database connection instance
* **Schema**: `src/db/schema.ts` - Three main tables:
  * `airport` - Airport data with IATA/ICAO codes and PostGIS geometry
  * `airline` - Airline data with IATA/ICAO codes
  * `alert` - User flight alerts with JSONB filters, status, and timestamps
* **ID Generation**: Custom prefixed ULIDs (e.g., `apt-01hcb3dxj4nb7j7gk0m9p6htm8`)
  * Generated via `src/db/id.ts:generateId()`
  * Prefixes: `apt` (airport), `alt` (alert), `aln` (airline)

### Authentication & Middleware

* **Auth Provider**: Supabase with SSR support
* **Server Client**: `src/lib/supabase/server.ts` - For Server Components/Actions
* **Middleware**: `src/middleware.ts` uses `src/lib/supabase/middleware.ts:updateSession()`
  * Validates session on every request
  * Redirects unauthenticated users to `/login` (except public routes)
  * Public routes: `/`, `/login`, `/auth`, `/error`, `/api/*`, `/auth/*`, `/error/*`
  * **Critical**: Always return the `supabaseResponse` object to maintain session sync

### Business Logic Layer

* **Alerts Service**: `src/core/alerts-service.ts` - High-level business logic
  * Validates alert filters (airports/airlines exist, price positive, no same origin/destination)
  * User ownership verification
  * Custom errors: `AlertValidationError`, `AlertNotFoundError`
* **Alerts DB**: `src/core/alerts-db.ts` - Database operations for alerts
* **Filters**: `src/core/filters.ts` - Zod schemas for alert filters (versioned with discriminated union)

### Environment Variables

Managed by `@t3-oss/env-nextjs` in `src/env.ts` with Zod validation:

* `DATABASE_URL` - PostgreSQL connection string
* `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
* `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - Supabase anon key
* `SUPABASE_SECRET_KEY` - Supabase service role key
* `NEXT_PUBLIC_MAPKIT_TOKEN` - Apple MapKit JS token

Reference `.env.example` for required variables.

### UI Components

* **Framework**: Radix UI primitives with custom styling
* **Location**: `src/components/ui/*` - Reusable UI components
* **Custom Components**:
  * `src/components/airport-search.tsx` - Airport search interface
  * `src/components/airport-map.tsx` - MapKit integration
* **Styling**: Tailwind CSS 4 with `class-variance-authority` for variants
* **Theme**: `next-themes` for dark mode support
* **Notifications**: Sonner for toast messages
* **Forms**: React Hook Form with Zod resolvers

### Path Aliases

TypeScript and Vitest configured with `@/*` alias mapping to `./src/*`

## Key Patterns

### Alert Filter Versioning

Alert filters use a versioned schema pattern with Zod discriminated unions (`src/core/filters.ts`). Current version is `v1`. When adding new versions:

1. Create new schema (e.g., `AlertFiltersV2Schema`)
2. Add to `AlertFiltersSchema` discriminated union
3. Database stores filters as JSONB, allowing schema evolution

### ID System

All database IDs use prefixed ULIDs for type safety and debuggability:

* Generate: `generateId("airport")` → `"apt-01hcb..."`
* Validate/cast: `castId<"airport">("apt-01hcb...")` (throws if prefix mismatch)

### Supabase SSR Pattern

* Server Components: Use `createClient()` from `src/lib/supabase/server.ts`
* Middleware: Use `updateSession()` from `src/lib/supabase/middleware.ts`
* Never modify cookies manually - always use Supabase client methods
