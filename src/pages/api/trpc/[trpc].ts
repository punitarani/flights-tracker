import { createNextApiHandler } from "@trpc/server/adapters/next";

import { createContext } from "@/server/context";
import { appRouter } from "@/server/routers/app";

export default createNextApiHandler({
  router: appRouter,
  createContext,
  onError({ path, error }) {
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    console.error(`tRPC failed on ${path ?? "unknown path"}:`, error);
  },
  responseMeta({ type, errors, paths }) {
    if (type !== "query" || errors.length > 0) {
      return {};
    }

    const isAirportsSearch =
      Array.isArray(paths) &&
      paths.length === 1 &&
      paths[0] === "airports.search";

    if (!isAirportsSearch) {
      return {};
    }

    return {
      headers: {
        "Cache-Control": "s-maxage=3600, stale-while-revalidate=300",
      },
    };
  },
});
