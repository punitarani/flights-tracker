#!/usr/bin/env bun

import { getArgs } from "./utils/args";

function parseArgs() {
  const args = getArgs();
  const [userId, ...rest] = args;

  if (!userId) {
    console.error(
      "Usage: bun scripts/send-email-to-user.ts <user-id> [--force] [--local]",
    );
    process.exit(1);
  }

  const config: { userId: string; force?: boolean; local?: boolean } = {
    userId,
  };

  for (const option of rest) {
    if (option === "--force") {
      config.force = true;
    } else if (option === "--local") {
      config.local = true;
    }
  }

  return config;
}

async function main() {
  const { userId, force, local } = parseArgs();

  const workerUrl = local ? "http://localhost:8787" : process.env.WORKER_URL;

  if (!workerUrl) {
    console.error(
      "WORKER_URL is required unless --local is specified. Set WORKER_URL environment variable.",
    );
    process.exit(1);
  }

  const apiKey = process.env.WORKER_API_KEY;

  const response = await fetch(`${workerUrl}/trigger/process-user-alerts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ userId, forceSend: force }),
  });

  if (!response.ok) {
    console.error(
      `Failed to trigger workflow: ${response.status} ${response.statusText}`,
    );
    const text = await response.text();
    console.error(text);
    process.exit(1);
  }

  const result = await response.json();
  console.log("Workflow triggered", result);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
