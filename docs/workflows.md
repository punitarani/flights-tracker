# Cloudflare Workers - Flight Alert Processing

Automated flight alert processing using Cloudflare Workflows and Queues.

## Architecture Overview

### Flow

```
Cloudflare Cron (every 6h: 00:00, 06:00, 12:00, 18:00 UTC)
    ↓
CheckFlightAlertsWorkflow
    ├─ Fetch all user IDs with active daily alerts
    └─ Queue user IDs to flights-tracker-alerts-queue (batches of 100)
         ↓
Queue Consumer (max 10 concurrent, auto-scales)
    ↓
ProcessFlightAlertsWorkflow_{userId}_{date}
    ├─ Check email eligibility (6-9 PM UTC + 24h limit)
    ├─ Fetch active alerts for user
    ├─ Filter expired/processed alerts
    ├─ Fetch flight data (via /api/flights)
    ├─ Send email (if eligible)
    └─ Record notification in DB
```

### Code Structure

```
src/workers/                     (~350 lines of Cloudflare-specific code)
├── index.ts                     # Handlers (scheduled, queue, fetch)
├── env.d.ts                     # Worker environment types
├── db.ts                        # Worker DB connection
├── workflows/
│   ├── check-flight-alerts.ts   # Workflow 1: Fetch users → queue
│   └── process-flight-alerts.ts # Workflow 2: Process alerts → send email
├── adapters/                    # Thin wrappers around src/core
│   ├── alerts-db.ts             # DB operations wrapper
│   └── alert-processing.ts      # Processing logic wrapper (parallelized)
└── utils/                       # Worker-specific utilities
    ├── logger.ts                # Structured logging
    ├── user.ts                  # User email fetching (Supabase)
    └── flights-search.ts        # Flight data API calls (parallelized)
```

**Key Design:** Workers import directly from `src/core/`, `src/db/`, and `src/lib/` for ~90% code reuse with zero duplication.

## Seats.aero Search Workflow

### ProcessSeatsAeroSearchWorkflow

**Purpose:** Asynchronously fetches award flight availability data from seats.aero API

**Trigger:** HTTP endpoint `/trigger/seats-aero-search` (called by Next.js API when frontend requests data)

**Instance ID Pattern:**
```
ProcessSeatsAeroSearch_{origin}_{dest}_{startDate}_{endDate}
Example: ProcessSeatsAeroSearch_SFO_NRT_2025-10-15_2025-10-22
```

**Flow:**
```
Frontend Request (tRPC)
    ↓
Service Layer (searchSeatsAero)
    ├─ Check DB for search request
    ├─ If completed: return trips
    ├─ If pending/processing: return status + partial trips
    ├─ If failed: delete and recreate
    └─ If not exists: create + trigger workflow
         ↓
    Return status: 'pending' immediately
         ↓
Worker HTTP Endpoint (/trigger/seats-aero-search)
    ↓
ProcessSeatsAeroSearchWorkflow_{origin}_{dest}_{dates}
    ├─ Validate search request exists
    ├─ Fetch from seats.aero API (paginated)
    ├─ Store individual trips in DB
    ├─ Update progress (cursor, count)
    └─ Mark completed or failed
         ↓
Frontend polls every 3s (TanStack Query)
    ↓
Once completed: returns trips from DB
```

**Configuration:**
- Timeout: 30 minutes
- Retries: 3 attempts with exponential backoff
- Retry delay: 5 minutes
- TTL: Search requests expire after 60 minutes
- Trip TTL: Trips expire after 120 minutes
- Pagination: 1000 results per page

**Idempotency:**
- Only 1 workflow per route + date range (enforced by instance ID)
- Duplicate triggers are safely ignored by Cloudflare
- Failed searches can be retried after deletion

**Monitoring:**
```bash
# List instances
bunx wrangler workflows instances list seats-aero-search

# Check specific route
bunx wrangler workflows instances describe seats-aero-search \
  ProcessSeatsAeroSearch_SFO_NRT_2025-10-15_2025-10-22

# Trigger manually (requires WORKER_API_KEY)
curl -X POST https://your-worker.workers.dev/trigger/seats-aero-search \
  -H "Authorization: Bearer $WORKER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"originAirport":"SFO","destinationAirport":"NRT","searchStartDate":"2025-10-15","searchEndDate":"2025-10-22"}'
```

**Database Tables:**
- `seats_aero_search_request` - Tracks search status and pagination state
- `seats_aero_availability_trip` - Individual flight availability records

**Integration:**
- Next.js service layer calls worker endpoint to trigger workflow
- Frontend polls tRPC endpoint until status is "completed"
- TanStack Query handles automatic 3-second polling
- Workflow stores data in database for immediate access

## Email Sending Rules

Emails sent **ONLY** when ALL conditions are met:

1. ✅ Current time: 18:00-21:59 UTC (6-9 PM)
2. ✅ Last email >24 hours ago (from `notification` table)
3. ✅ User has active daily alerts
4. ✅ At least one alert has matching flights

Cron runs every 6 hours for data freshness, but email sending is gated by time window check.

## Configuration (wrangler.toml)

```toml
# Cron Triggers
[triggers]
crons = ["0 */6 * * *"]  # Every 6 hours

# Workflows
[[workflows]]
name = "check-flight-alerts"
binding = "CHECK_ALERTS_WORKFLOW"
class_name = "CheckFlightAlertsWorkflow"

[[workflows]]
name = "process-flight-alerts"
binding = "PROCESS_ALERTS_WORKFLOW"
class_name = "ProcessFlightAlertsWorkflow"

[[workflows]]
name = "seats-aero-search"
binding = "SEATS_AERO_SEARCH_WORKFLOW"
class_name = "ProcessSeatsAeroSearchWorkflow"

# Queue
[[queues.consumers]]
queue = "flights-tracker-alerts-queue"
max_concurrency = 10      # Max 10 users processed concurrently
max_batch_size = 10
max_batch_timeout = 30

# Observability
observability.enabled = true
observability.head_sampling_rate = 1

# Compatibility
compatibility_flags = ["nodejs_compat", "nodejs_als", "nodejs_compat_populate_process_env"]
```

## Deployment

### Prerequisites

```bash
bun install
```

Installs: `wrangler`, `@cloudflare/workers-types`

### Step 1: Create Queue

```bash
bunx wrangler queues create flights-tracker-alerts-queue
```

### Step 2: Configure Secrets

```bash
# Required secrets
bunx wrangler secret put DATABASE_URL
bunx wrangler secret put RESEND_API_KEY
bunx wrangler secret put SUPABASE_URL
bunx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
bunx wrangler secret put NEXTJS_API_URL
bunx wrangler secret put SEATS_AERO_API_KEY

# Security (highly recommended for production)
bunx wrangler secret put WORKER_API_KEY  # Generate a strong random key

# Optional (recommended)
bunx wrangler secret put RESEND_FROM_EMAIL
bunx wrangler secret put DISABLE_MANUAL_TRIGGERS  # Set to "true" to disable manual HTTP triggers
```

**Secret Values:**

* `DATABASE_URL`: PostgreSQL connection string (same as Next.js)
* `RESEND_API_KEY`: Resend API key for email sending
* `SUPABASE_URL`: `https://YOUR_PROJECT.supabase.co`
* `SUPABASE_SERVICE_ROLE_KEY`: Service role key from Supabase dashboard
* `NEXTJS_API_URL`: Production URL of Next.js app (e.g., `https://flights-tracker.vercel.app`)
* `SEATS_AERO_API_KEY`: Seats.aero API key
* `WORKER_API_KEY`: Strong random key for manual trigger authentication (generate with: `openssl rand -base64 32`)
* `DISABLE_MANUAL_TRIGGERS`: Set to `"true"` to completely disable manual HTTP triggers
* `RESEND_FROM_EMAIL`: Email sender (default: `alerts@graypane.com`)

### Step 3: Deploy

```bash
bun run worker:deploy
```

### Step 4: Configure Next.js Environment

The Next.js application needs to know how to communicate with the worker for seats.aero searches:

```bash
# .env.local (for local development)
WORKER_URL=http://localhost:8787  # or your worker URL
WORKER_API_KEY=your-api-key

# Vercel (for production)
vercel env add WORKER_URL
# Enter: https://your-worker.workers.dev

vercel env add WORKER_API_KEY
# Enter: same key as WORKER_API_KEY in Cloudflare secrets
```

**Important:** The `WORKER_API_KEY` must be the same in both:
- Cloudflare Worker secrets (for authenticating incoming requests)
- Next.js environment variables (for authenticating outgoing requests)

### Step 5: Verify

```bash
# Check workflows registered (should show 3 workflows)
bunx wrangler workflows list

# View live logs
bun run worker:tail

# Wait for next cron (00:00, 06:00, 12:00, 18:00 UTC)
# OR trigger manually for testing:
curl -X POST https://YOUR-WORKER.workers.dev/trigger/check-alerts \
  -H "Authorization: Bearer $WORKER_API_KEY"

# Test seats.aero workflow
curl -X POST https://YOUR-WORKER.workers.dev/trigger/seats-aero-search \
  -H "Authorization: Bearer $WORKER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"originAirport":"SFO","destinationAirport":"NRT","searchStartDate":"2025-11-01","searchEndDate":"2025-11-08"}'
```

## Development

### Local Testing

```bash
# Terminal 1: Next.js app (for /api/flights endpoint)
bun run dev

# Terminal 2: Worker with hot reload
bun run worker:dev

# Terminal 3: Trigger cron manually
curl "http://localhost:8787/cdn-cgi/handler/scheduled"

# OR trigger via HTTP endpoint
curl -X POST http://localhost:8787/trigger/check-alerts
```

### Available Scripts

From project root:

```bash
bun run worker:dev      # Local development with hot reload
bun run worker:deploy   # Deploy to Cloudflare
bun run worker:tail     # Stream live logs from production
bun run test:workers    # Run worker test suite (37 tests)
```

### Manual Workflow Trigger

Use the trigger script to manually process alerts for all users (useful for testing and debugging):

**Trigger Workflow:**

```bash
# Production
WORKER_URL=https://your-worker.workers.dev bun run trigger:alerts

# Local development (requires worker:dev to be running)
bun run trigger:alerts:local
```

**Script Options:**

* `--local, -l` - Use local worker (http://localhost:8787)
* `--help, -h` - Show help message

**Example Usage:**

```bash
# Trigger workflow locally
bun run trigger:alerts:local

# Trigger workflow in production
export WORKER_URL=https://flights-tracker-worker.your-subdomain.workers.dev
bun run trigger:alerts

# View help
bun scripts/trigger-alerts.ts --help
```

**What Happens:**

1. Triggers CheckFlightAlertsWorkflow for all users
2. Fetches all user IDs with active daily alerts from database
3. Queues users to flights-tracker-alerts-queue in batches of 100
4. Queue consumer processes up to 10 users concurrently
5. Each user gets a ProcessFlightAlertsWorkflow instance
6. Emails sent if eligible (6-9 PM UTC, once per 24h)
7. Instance IDs include `_manual` suffix to distinguish from cron triggers
8. Real-time status and monitoring commands displayed after trigger

## Security

### Overview

The worker implements multiple layers of security to prevent unauthorized access:

1. **API Key Authentication** - Protects manual HTTP triggers
2. **Audit Logging** - Tracks all manual triggers via structured logs
3. **Workflow Validation** - Validates user data before processing
4. **Environment-Based Controls** - Ability to disable manual triggers entirely

### API Key Authentication

Manual HTTP triggers (`/trigger/check-alerts`) require authentication via API key.

**Setup:**

```bash
# Generate a strong random API key
openssl rand -base64 32

# Set as Cloudflare secret
bunx wrangler secret put WORKER_API_KEY
```

**Usage:**

```bash
# With curl
curl -X POST https://your-worker.workers.dev/trigger/check-alerts \
  -H "Authorization: Bearer YOUR_API_KEY"

# With trigger script
WORKER_API_KEY=your_key bun run trigger:alerts
```

**Behavior:**

* ✅ If `WORKER_API_KEY` is not set: Allows all requests (development mode)
* ❌ If `WORKER_API_KEY` is set but request has no/invalid key: Returns 401 Unauthorized
* ✅ If `WORKER_API_KEY` matches request header: Allows request

### Audit Logging

All manual workflow triggers are logged to structured logs for audit trail.

**Logged Information:**

* Timestamp
* Client IP address
* User agent
* Authentication status
* Instance ID

**View Logs:**

```bash
# Live logs
bun run worker:tail
```

### Workflow Validation

`ProcessFlightAlertsWorkflow` validates that the user has active alerts before processing (defense-in-depth).

**Validation Steps:**

1. Check if `userId` exists in database
2. Verify user has active daily alerts
3. Skip processing if validation fails

This prevents malicious actors from triggering workflows for invalid or inactive users.

**Code Location:** `src/workers/workflows/process-flight-alerts.ts:41-73`

### Disabling Manual Triggers

For maximum security in production, you can completely disable manual HTTP triggers.

**Setup:**

```bash
bunx wrangler secret put DISABLE_MANUAL_TRIGGERS
# Enter: true
```

**Effect:**

* All requests to `/trigger/*` endpoints return 401 Unauthorized
* Only cron-triggered workflows will run
* Prevents any manual intervention

### Security Best Practices

**Production Deployment:**

1. ✅ Always set `WORKER_API_KEY` to a strong random value
2. ✅ Store API key securely (password manager, secrets vault)
3. ✅ Rotate API key periodically (e.g., quarterly)
4. ✅ Monitor worker logs for unauthorized access attempts
5. ✅ Consider setting `DISABLE_MANUAL_TRIGGERS=true` if manual triggers aren't needed

**API Key Management:**

```bash
# Generate new key
openssl rand -base64 32

# Update in Cloudflare
bunx wrangler secret put WORKER_API_KEY

# Update in local environment for trigger script
export WORKER_API_KEY="your_new_key"
```

**Monitoring for Attacks:**

Look for these patterns in logs:

* Multiple 401 Unauthorized responses (brute force attempts)
* Unusual IP addresses in audit logs
* Unexpected spike in manual triggers

### Threat Model

**Protected Against:**

* ✅ Unauthorized workflow triggering
* ✅ Processing alerts for invalid users
* ✅ Timing attacks (constant-time API key comparison)

**Not Protected Against:**

* ❌ Compromised `WORKER_API_KEY` (rotate immediately if leaked)
* ❌ DOS/abuse via repeated triggering (consider adding rate limiting if needed)
* ❌ Cloudflare account compromise (use strong passwords + 2FA)
* ❌ Database compromise (separate concern)

## Monitoring & Observability

### Cloudflare Dashboard

**Workers & Pages → Your Worker:**

* Execution history
* Error rates
* Step duration
* Real-time metrics

### Workflow Commands

```bash
# List all workflows
bunx wrangler workflows list

# List workflow instances
bunx wrangler workflows instances list check-flight-alerts
bunx wrangler workflows instances list process-flight-alerts

# Check latest workflow status
bunx wrangler workflows instances describe check-flight-alerts latest

# Check specific user's workflow
bunx wrangler workflows instances describe process-flight-alerts \
  ProcessFlightAlertsWorkflow_USER_ID_2025-10-12

# View detailed workflow step execution
bunx wrangler workflows instances describe process-flight-alerts latest --full
```

### Queue Monitoring

```bash
# Queue metrics (Cloudflare Dashboard)
# Workers & Pages → Queues → flights-tracker-alerts-queue

# Pause queue delivery (for maintenance)
bunx wrangler queues pause-delivery flights-tracker-alerts-queue

# Resume queue delivery
bunx wrangler queues resume-delivery flights-tracker-alerts-queue
```

## Testing

### Test Suite

Comprehensive test coverage with 37 passing tests:

```bash
# Run all worker tests
bun run test:workers

# Run in watch mode
bun run test:workers:watch

# Run specific test file
bun test src/workers/utils/logger.test.ts
```

**Test Coverage:**

* ✅ **20 tests** - Utils (logger, user, flights-search)
* ✅ **6 tests** - Adapters (alerts-db, alert-processing)
* ✅ **8 tests** - Workflows (check, process)
* ✅ **9 tests** - Handlers (scheduled, queue, fetch)
* ✅ **8 tests** - E2E flow validation

**Testing Strategy:**
Tests validate business logic, data structures, and configuration without requiring Cloudflare Workers runtime, making them fast and CI/CD-friendly (<100ms execution).

## Performance Optimizations

### Parallel Async Execution

Alert processing is optimized for maximum concurrency:

**Alert Processing (`adapters/alert-processing.ts`):**

* ✅ Parallel airport lookups for alert descriptors
* ✅ Parallel alert deduplication checks
* ✅ Parallel expired alert DB updates
* ✅ Parallel alert-to-descriptor conversions

**Flight Fetching (`utils/flights-search.ts`):**

* ✅ Parallel flight API calls for all alerts using `Promise.all`
* ✅ Graceful error handling per alert (failures don't block others)

**Result:** Minimal latency even with many alerts per user.

## Key Benefits

1. ✅ **Zero Code Duplication** - Workers import from `src/`
2. ✅ **Single Package** - One `package.json`, one dependency tree
3. ✅ **Minimal Code** - Only ~350 lines of Cloudflare-specific code
4. ✅ **Durable Execution** - Auto-retry, state persistence
5. ✅ **Controlled Concurrency** - Max 10 users processed simultaneously
6. ✅ **Time-Based Sending** - Built-in 6-9 PM UTC window
7. ✅ **Full Observability** - Structured logging and Cloudflare monitoring
8. ✅ **Idempotent** - Instance IDs prevent duplicate processing
9. ✅ **Optimized Performance** - Parallel async operations throughout

## Troubleshooting

### No emails being sent

**Check:**

1. Current time is 6-9 PM UTC (18:00-21:59)
2. User hasn't received email in last 24 hours (query `notification` table)
3. User has active daily alerts (not expired)
4. At least one alert has matching flights (check API response)

**Debug:**

```bash
bun run worker:tail  # View live logs
# Look for "Skipping - not eligible for email" with reason
```

### Workflow failures

**View failed workflow:**

```bash
bunx wrangler workflows instances list process-flight-alerts
# Find failed instance ID
bunx wrangler workflows instances describe process-flight-alerts INSTANCE_ID
```

**Common issues:**

* Database connection: Verify `DATABASE_URL` secret
* API errors: Check `NEXTJS_API_URL` is accessible from worker
* Email sending: Verify `RESEND_API_KEY` is valid

### Queue backlog

**Check queue status:**

```bash
# Dashboard → Workers & Pages → Queues → flights-tracker-alerts-queue
```

**If backlogged:**

* Increase `max_concurrency` in `wrangler.toml` (current: 10)
* Check for slow workflow executions in dashboard
* Verify no repeated failures causing retries

## Migration Notes

### Replaced Systems

**Before:** Supabase cron → HTTP webhooks → pgmq queue → process alerts

**After:** Cloudflare cron → Workflow → Cloudflare Queue → Workflow → process alerts

### Removed Code

* ❌ `src/app/api/webhooks/` (3 files)
* ❌ `WEBHOOK_SECRET` environment variable
* ❌ `acquireUserLock()` from `src/core/alerts-db.ts` (Supabase-specific)

### Added Code

* ✅ `src/workers/` (9 files, ~350 lines)
* ✅ `src/app/api/flights/route.ts` (REST endpoint for workers)
* ✅ `wrangler.toml` (worker configuration)

## Rollback

If issues arise after deployment:

```bash
# Pause cron trigger
# Cloudflare Dashboard → Workers & Pages → Your Worker → Triggers → Disable cron

# Pause queue processing
bunx wrangler queues pause-delivery flights-tracker-alerts-queue

# Re-enable Supabase cron if needed (if kept as backup)
```

## Additional Resources

* [Cloudflare Workflows Docs](https://developers.cloudflare.com/workflows/)
* [Cloudflare Queues Docs](https://developers.cloudflare.com/queues/)
* [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/commands/)
