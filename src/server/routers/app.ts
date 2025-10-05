import { createRouter } from "../trpc";
import { healthRouter } from "./health";

export const appRouter = createRouter().merge("health.", healthRouter);

export type AppRouter = typeof appRouter;
