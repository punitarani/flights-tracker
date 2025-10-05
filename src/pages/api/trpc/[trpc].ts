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
});
