import { createRouter } from "../trpc";
import { airportsRouter } from "./airports";
import { alertsRouter } from "./alerts";
import { flightsRouter } from "./flights";
import { healthRouter } from "./health";
import { seatsAeroRouter } from "./seats-aero";

export const appRouter = createRouter()
  .merge("health.", healthRouter)
  .merge("airports.", airportsRouter)
  .merge("flights.", flightsRouter)
  .merge("alerts.", alertsRouter)
  .merge("seatsAero.", seatsAeroRouter);

export type AppRouter = typeof appRouter;
