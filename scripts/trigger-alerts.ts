/**
 * Manual trigger script for flight alert processing workflow
 *
 * Usage:
 *   bun scripts/trigger-alerts.ts             # Trigger production workflow
 *   bun scripts/trigger-alerts.ts --local     # Trigger local workflow
 *   bun scripts/trigger-alerts.ts --help      # Show help
 *
 * Examples:
 *   bun scripts/trigger-alerts.ts --local
 *   WORKER_URL=https://your-worker.workers.dev bun scripts/trigger-alerts.ts
 */

interface TriggerOptions {
  local: boolean;
  help: boolean;
}

/**
 * Parses command line arguments
 */
function parseArgs(): TriggerOptions {
  const args = process.argv.slice(2);
  const options: TriggerOptions = {
    local: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--local" || arg === "-l") {
      options.local = true;
    }
  }

  return options;
}

/**
 * Displays usage information
 */
function showHelp(): void {
  console.log(`
Flight Alert Workflow Trigger

Triggers the CheckFlightAlertsWorkflow which processes all users with active daily alerts.

Usage:
  bun scripts/trigger-alerts.ts [options]

Options:
  --local, -l           Use local worker (http://localhost:8787)
  --help, -h            Show this help message

Examples:
  # Trigger workflow in production
  WORKER_URL=https://your-worker.workers.dev bun scripts/trigger-alerts.ts

  # Trigger workflow locally (requires worker:dev to be running)
  bun scripts/trigger-alerts.ts --local

  # Or use npm scripts
  bun run trigger:alerts              # Production
  bun run trigger:alerts:local        # Local

Environment Variables:
  WORKER_URL            Production worker URL (required if not using --local)
                        Example: https://flights-tracker-worker.YOUR_SUBDOMAIN.workers.dev
  WORKER_API_KEY        API key for authentication (recommended for production)
                        Set this secret in Cloudflare: bunx wrangler secret put WORKER_API_KEY

Notes:
  - Triggers CheckFlightAlertsWorkflow (fetches all users with active daily alerts)
  - Users are queued to flights-tracker-alerts-queue in batches of 100
  - Queue consumer processes up to 10 users concurrently
  - Each user gets a ProcessFlightAlertsWorkflow instance
  - Emails sent if eligible (6-9 PM UTC, once per 24h)
  - Local mode requires worker to be running: bun run worker:dev
  `);
}

/**
 * Gets the worker base URL based on environment
 */
function getWorkerUrl(local: boolean): string {
  if (local) {
    return "http://localhost:8787";
  }

  const workerUrl = process.env.WORKER_URL;
  if (!workerUrl) {
    throw new Error(
      "WORKER_URL environment variable is required for production.\n" +
        "Example: WORKER_URL=https://flights-tracker-worker.YOUR_SUBDOMAIN.workers.dev",
    );
  }

  return workerUrl;
}

/**
 * Gets the API key for authentication
 */
function getApiKey(): string | undefined {
  return process.env.WORKER_API_KEY;
}

/**
 * Triggers the check-alerts workflow (all users)
 */
async function triggerWorkflow(workerUrl: string): Promise<void> {
  console.log("🚀 Triggering CheckFlightAlertsWorkflow...");
  console.log(`   URL: ${workerUrl}/trigger/check-alerts\n`);

  try {
    const apiKey = getApiKey();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add Authorization header if API key is provided
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
      console.log("   🔐 Using API key authentication\n");
    } else {
      console.log(
        "   ⚠️  No API key provided (set WORKER_API_KEY env var for production)\n",
      );
    }

    const response = await fetch(`${workerUrl}/trigger/check-alerts`, {
      method: "POST",
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const result = (await response.json()) as {
      success: boolean;
      instanceId: string;
      status?: { status: string };
    };

    console.log("✅ Workflow triggered successfully!");
    console.log(`   Instance ID: ${result.instanceId}`);
    console.log(`   Status: ${result.status?.status || "unknown"}\n`);

    console.log("📋 What happens next:");
    console.log("   1. Workflow fetches all user IDs with active daily alerts");
    console.log(
      "   2. User IDs are queued to flights-tracker-alerts-queue (batches of 100)",
    );
    console.log("   3. Queue consumer processes up to 10 users concurrently");
    console.log("   4. Each user gets a ProcessFlightAlertsWorkflow instance");
    console.log("   5. Emails sent if eligible (6-9 PM UTC, once per 24h)\n");

    console.log("🔍 Monitor progress:");
    console.log("   Logs: bun run worker:tail");
    console.log(
      `   Status: bunx wrangler workflows instances describe check-flight-alerts ${result.instanceId}`,
    );
  } catch (error) {
    console.error("❌ Failed to trigger workflow:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    return;
  }

  console.log("\n🎯 Flight Alert Workflow Trigger\n");
  console.log(`   Environment: ${options.local ? "LOCAL" : "PRODUCTION"}\n`);

  try {
    const workerUrl = getWorkerUrl(options.local);
    await triggerWorkflow(workerUrl);
    console.log("✨ Done!\n");
  } catch (error) {
    console.error("\n❌ Error:");
    console.error(error instanceof Error ? error.message : String(error));
    console.log("\nRun with --help for usage information.\n");
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main();
}
