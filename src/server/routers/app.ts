import { createRouter } from "../trpc";
import { airportsRouter } from "./airports";
import { healthRouter } from "./health";

export const appRouter = createRouter()
  .merge("health.", healthRouter)
  .merge("airports.", airportsRouter);

export type AppRouter = typeof appRouter;
