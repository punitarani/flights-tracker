import { router } from "../trpc";
import { airportsRouter } from "./airports";

/**
 * Main tRPC router
 */
export const appRouter = router({
  airports: airportsRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;
