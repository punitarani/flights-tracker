import * as trpc from "@trpc/server";
import superjson from "superjson";

import type { Context } from "./context";

export const createRouter = () => trpc.router<Context>().transformer(superjson);
