import { createRouter } from "../trpc";
import { airportsRouter } from "./airports";
import { flightsRouter } from "./flights";
import { healthRouter } from "./health";

export const appRouter = createRouter()
  .merge("health.", healthRouter)
  .merge("airports.", airportsRouter)
  .merge("flights.", flightsRouter);

export type AppRouter = typeof appRouter;
