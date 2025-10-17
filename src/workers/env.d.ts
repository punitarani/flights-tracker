/**
 * Cloudflare Worker environment bindings and variables
 */

export interface WorkerEnv {
  // Workflows
  CHECK_ALERTS_WORKFLOW: Workflow;
  PROCESS_ALERTS_WORKFLOW: Workflow;
  SEATS_AERO_SEARCH_WORKFLOW: Workflow;

  // Queue
  ALERTS_QUEUE: Queue<QueueMessage>;

  // Hyperdrive - Global connection pooling for PostgreSQL
  HYPERDRIVE: Hyperdrive;

  // Environment variables
  DATABASE_URL: string;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL?: string;
  SEATS_AERO_API_KEY: string;

  // Supabase (for fetching user emails)
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;

  // Sentry (for error tracking)
  SENTRY_DSN: string;
  SENTRY_ENVIRONMENT: string;

  // Security
  WORKER_API_KEY?: string; // API key for manual trigger authentication
  DISABLE_MANUAL_TRIGGERS?: string; // Set to "true" to disable manual HTTP triggers

  // Proxy configuration (optional)
  PROXY_ENABLED?: string;
  PROXY_HOST?: string;
  PROXY_PORT?: string;
  PROXY_USERNAME?: string;
  PROXY_PASSWORD?: string;
  PROXY_PROTOCOL?: string;
}

export interface QueueMessage {
  userId: string;
}
