# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js 15 application for tracking flight alerts with Supabase authentication, PostgreSQL database (via Drizzle ORM), and Apple MapKit integration. Built with React 19, TypeScript, and Tailwind CSS.

## Development Commands

### Running the Application

* `bun run dev` - Start development server with Turbopack
* `bun run build` - Build production bundle with Turbopack
* `bun start` - Start production server

### Testing

* `bun test` - Run all tests concurrently with Bun's built-in test runner
* `bun run test:watch` - Run tests in watch mode
* `bun run test:fli` - Run fli integration tests with extended timeout (60s)
* `bun run test:workers` - Run Cloudflare Worker tests (43 tests)
* `bun run test:workers:watch` - Run worker tests in watch mode
* Test files: `*.test.ts` files alongside source code
* Test setup: `src/test/setup.ts` (mocks env, db client, console) - preloaded automatically
* Worker test setup: `src/workers/test/setup.ts` (mocks worker environment)
* Tests run concurrently (like Vitest) for faster execution
* Uses happy-dom for DOM testing

### Code Quality

* `bun run lint` - Run Biome linter and auto-fix issues (with --unsafe flag)
* `bun run format` - Format code with Biome

### Cloudflare Workers

* `bun run worker:dev` - Start worker with local development server
* `bun run worker:deploy` - Deploy worker to Cloudflare
* `bun run worker:tail` - Stream live logs from production worker
* `bun run trigger:alerts` - Manually trigger alert processing (production)
* `bun run trigger:alerts:local` - Manually trigger alert processing (local)
* `bunx wrangler workflows list` - List registered workflows
* `bunx wrangler workflows instances list <workflow-name>` - List workflow instances

### Database (Drizzle ORM)

* `bun run db:generate` - Generate migration files from schema changes
* `bun run db:push` - Push schema changes directly to database (development)
* `bun run db:studio` - Launch Drizzle Studio database GUI
* `bun run db:migrate` - Run pending migrations
* Schema: `src/db/schema.ts`
* Config: `drizzle.config.ts`
* Migrations directory: `./migrations`

## Architecture

### API Layer (tRPC)

* **Router Setup**: `src/server/trpc.ts` - tRPC server configuration
* **Routers**: `src/server/routers/` - API endpoints
  * `alerts.ts` - Alert CRUD operations and management
  * `flights.ts` - Flight search and data retrieval
  * `airports.ts` - Airport data and search
  * `seats-aero.ts` - Award flight availability searches
  * `health.ts` - Health check endpoint
  * `app.ts` - Main router combining all sub-routers
* **Client Setup**: `src/lib/trpc/` - React Query integration
  * `provider.tsx` - tRPC Provider component for app context
  * `react.ts` - React Query hooks for tRPC procedures
* **Error Handling**: Automatic `TRPCError` handling with proper HTTP status codes
* **Type Safety**: End-to-end type safety from server to client

### Database Layer

* **ORM**: Drizzle with PostgreSQL (postgres.js driver)
* **Client**: `src/db/client.ts` - Single database connection instance
* **Schema**: `src/db/schema.ts` - Main tables:
  * `airport` - Airport data with IATA/ICAO codes and PostGIS geometry
  * `airline` - Airline data with IATA/ICAO codes
  * `alert` - User flight alerts with JSONB filters, status, and timestamps
  * `seats_aero_search_request` - Tracks async search status and pagination
  * `seats_aero_availability_trip` - Individual award flight availability records
  * `notification` - Email delivery tracking and rate limiting
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
* **Seats.aero DB**: `src/core/seats-aero.db.ts` - Seats.aero data management and search tracking
* **Notifications**: `src/lib/notifications/` - Email system
  * `send-notification.ts` - Unified notification delivery
  * `formatters.ts` - Email content formatting
  * `templates/` - Email templates (price-drop-alert, daily-price-update)
* **Filters**: `src/core/filters.ts` - Zod schemas for alert filters (versioned with discriminated union)
* **Alert Processing**: `src/core/alert-processing-service.ts` - Core alert matching logic

### Cloudflare Workers Layer

* **Entry Point**: `src/workers/index.ts` - Handlers for scheduled, queue, and fetch events
* **Workflows**: `src/workers/workflows/` - Durable workflow implementations
  * `check-flight-alerts.ts` - Fetches active users and queues processing
  * `process-flight-alerts.ts` - Processes individual user alerts with email sending
  * `process-seats-aero-search.ts` - Async seats.aero API integration
* **Adapters**: `src/workers/adapters/` - Worker-specific wrappers around core services
  * `alerts-db.ts` - Database operations with worker DB client
  * `alert-processing.ts` - Parallelized alert processing
  * `seats-aero.db.ts` - Seats.aero data access for workers
* **Utils**: `src/workers/utils/` - Worker-specific utilities
  * `logger.ts` - Structured logging with context
  * `sentry.ts` - Error tracking and performance monitoring
  * `user.ts` - User data fetching from Supabase service client
  * `flights-search.ts` - Flight search via shared core logic (no Next.js API dependency)

### Environment Variables

#### Next.js Application

Managed by `@t3-oss/env-nextjs` in `src/env.ts` with Zod validation:

* `DATABASE_URL` - PostgreSQL connection string
* `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
* `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - Supabase anon key
* `SUPABASE_SECRET_KEY` - Supabase service role key
* `NEXT_PUBLIC_MAPKIT_TOKEN` - Apple MapKit JS token
* `WORKER_URL` - Cloudflare Workers URL for seats.aero searches
* `WORKER_API_KEY` - Authentication key for worker endpoints

Reference `.env.example` for required variables.

#### Cloudflare Workers

* `DATABASE_URL` - PostgreSQL connection string
* `RESEND_API_KEY` - Resend email service API key
* `SUPABASE_URL` - Supabase project URL
* `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
* `SEATS_AERO_API_KEY` - Seats.aero API key
* `WORKER_API_KEY` - API key for authenticating manual triggers
* `SENTRY_DSN` - Sentry project DSN (optional but recommended)
* `SENTRY_ENVIRONMENT` - Environment identifier for Sentry
* `DISABLE_MANUAL_TRIGGERS` - Set to "true" to disable manual HTTP triggers

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

### tRPC Usage

**Server-side router creation:**

```typescript
// src/server/routers/alerts.ts
export const alertsRouter = router({
  create: protectedProcedure
    .input(CreateAlertSchema)
    .mutation(async ({ ctx, input }) => {
      // Procedure implementation
    }),
});
```

**Client-side usage:**

```typescript
// In React component
const { data, isLoading } = api.alerts.getAll.useQuery();
const createAlert = api.alerts.create.useMutation();
```

**Error handling:**

```typescript
throw new TRPCError({
  code: "BAD_REQUEST",
  message: "Invalid alert data",
});
```

### Alert Filter Versioning

Alert filters use a versioned schema pattern with Zod discriminated unions (`src/core/filters.ts`). Current version is `v1`. When adding new versions:

1. Create new schema (e.g., `AlertFiltersV2Schema`)
2. Add to `AlertFiltersSchema` discriminated union
3. Database stores filters as JSONB, allowing schema evolution

### ID System

All database IDs use prefixed ULIDs for type safety and debuggability:

* Generate: `generateId("airport")` → `"apt-01hcb..."`
* Validate/cast: `castId<"airport">("apt-01hcb...")` (throws if prefix mismatch)

### Seats.aero Search Pattern

**Async search workflow:**

1. Frontend calls tRPC `seatsAero.search()` mutation
2. Service layer checks if search exists/exists in `seats_aero_search_request`
3. If not found, triggers `ProcessSeatsAeroSearchWorkflow` via worker HTTP endpoint
4. Worker fetches from seats.aero API with pagination
5. Individual trips stored in `seats_aero_availability_trip`
6. Frontend polls every 3s until status is "completed"

**Instance ID pattern:** `ProcessSeatsAeroSearch_{origin}_{dest}_{startDate}_{endDate}`

### Cloudflare Workers Pattern

**Workflow structure:**

* All workers import from `src/core/`, `src/db/`, and `src/lib/` for code reuse—no calls back into the Next.js app
* Use structured logging via `src/workers/utils/logger.ts`
* Sentry integration for error tracking and performance monitoring
* Parallel async operations for optimal performance

**Security:**

* Manual HTTP triggers require `WORKER_API_KEY` authentication
* All actions logged to Sentry for audit trail
* Can disable manual triggers entirely with `DISABLE_MANUAL_TRIGGERS=true`

### Supabase SSR Pattern

* Server Components: Use `createClient()` from `src/lib/supabase/server.ts`
* Middleware: Use `updateSession()` from `src/lib/supabase/middleware.ts`
* Never modify cookies manually - always use Supabase client methods
