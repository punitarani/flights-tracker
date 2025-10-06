import { createRouter } from "../trpc";
import { airportsRouter } from "./airports";
import { alertsRouter } from "./alerts";
import { flightsRouter } from "./flights";
import { healthRouter } from "./health";

export const appRouter = createRouter()
  .merge("health.", healthRouter)
  .merge("airports.", airportsRouter)
  .merge("flights.", flightsRouter)
  .merge("alerts.", alertsRouter);

export type AppRouter = typeof appRouter;
