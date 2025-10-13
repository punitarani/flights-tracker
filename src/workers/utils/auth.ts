/**
 * Authentication utilities for Cloudflare Workers
 */

import type { WorkerEnv } from "../env";
import { workerLogger } from "./logger";

export interface AuthResult {
  authenticated: boolean;
  reason?: string;
}

/**
 * Validates API key from Authorization header
 */
export function validateApiKey(request: Request, env: WorkerEnv): AuthResult {
  // Check if manual triggers are disabled
  if (env.DISABLE_MANUAL_TRIGGERS === "true") {
    workerLogger.warn("Manual triggers are disabled");
    return {
      authenticated: false,
      reason: "Manual triggers are disabled",
    };
  }

  // Check if API key is configured
  if (!env.WORKER_API_KEY) {
    workerLogger.warn("WORKER_API_KEY not configured - allowing request");
    return {
      authenticated: true,
      reason: "API key not configured (development mode)",
    };
  }

  // Extract Authorization header
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return {
      authenticated: false,
      reason: "Missing Authorization header",
    };
  }

  // Validate Bearer token format
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return {
      authenticated: false,
      reason: "Invalid Authorization header format. Expected: Bearer <token>",
    };
  }

  // Compare token using constant-time comparison
  if (!constantTimeCompare(token, env.WORKER_API_KEY)) {
    return {
      authenticated: false,
      reason: "Invalid API key",
    };
  }

  return { authenticated: true };
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Gets client IP address from request headers
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/**
 * Gets user agent from request headers
 */
export function getUserAgent(request: Request): string {
  return request.headers.get("User-Agent") || "unknown";
}
