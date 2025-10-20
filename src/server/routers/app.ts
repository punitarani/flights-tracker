import { router } from "../trpc";
import { airportsRouter } from "./airports";
import { alertsRouter } from "./alerts";
import { flightsRouter } from "./flights";
import { healthRouter } from "./health";
import { seatsAeroRouter } from "./seats-aero";

export const appRouter = router({
  health: healthRouter,
  airports: airportsRouter,
  flights: flightsRouter,
  alerts: alertsRouter,
  seatsAero: seatsAeroRouter,
});

export type AppRouter = typeof appRouter;
