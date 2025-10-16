import { createNextApiHandler } from "@trpc/server/adapters/next";

import { logger } from "@/lib/logger";
import { createContext } from "@/server/context";
import { appRouter } from "@/server/routers/app";

type TRPCJSONResponse =
  | {
      error: unknown;
    }
  | {
      result?: {
        type?: string;
        data?: unknown;
      };
    };

const PUBLIC_CACHEABLE_PATHS = new Set([
  "airports.search",
  "seatsAero.getAvailabilityByDay",
  "seatsAero.getTrips",
]);

const PRIVATE_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store",
};

const PUBLIC_CACHE_HEADERS = {
  "Cache-Control":
    "public, max-age=0, s-maxage=3600, stale-while-revalidate=300",
  Vary: "Authorization, Cookie",
};

function extractResultData(entry: TRPCJSONResponse | undefined): unknown {
  if (!entry || typeof entry !== "object" || !("result" in entry)) {
    return undefined;
  }

  const result = entry.result;
  if (!result || typeof result !== "object") {
    return undefined;
  }

  if (result.type !== "data") {
    return undefined;
  }

  return "data" in result ? result.data : undefined;
}

function isCacheable(path: string | undefined, payload: unknown): boolean {
  if (!path) {
    return false;
  }

  if (PUBLIC_CACHEABLE_PATHS.has(path)) {
    return payload !== undefined && payload !== null;
  }

  if (path === "seatsAero.search") {
    if (!payload || typeof payload !== "object") {
      return false;
    }

    const status = (payload as { status?: unknown }).status;
    return status === "completed";
  }

  return false;
}

export default createNextApiHandler({
  router: appRouter,
  createContext,
  onError({ path, error }) {
    logger.error("tRPC handler error", {
      path: path ?? "unknown",
      error,
    });
  },
  responseMeta({ type, errors, paths, data }) {
    if (type !== "query" || errors.length > 0 || !Array.isArray(paths)) {
      return { headers: PRIVATE_RESPONSE_HEADERS };
    }

    const headers: Record<string, string> = { ...PRIVATE_RESPONSE_HEADERS };

    if (paths.length === data.length) {
      let shouldCache = true;

      for (let index = 0; index < paths.length; index += 1) {
        const path = paths[index];
        const payload = extractResultData(data[index] as TRPCJSONResponse);

        if (!isCacheable(path, payload)) {
          shouldCache = false;
          break;
        }
      }

      if (shouldCache) {
        Object.assign(headers, PUBLIC_CACHE_HEADERS);
      }
    }

    return { headers };
  },
});
