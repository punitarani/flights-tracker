import { createReactQueryHooks } from "@trpc/react";

import type { AppRouter } from "@/server/routers/app";

export const trpc = createReactQueryHooks<AppRouter>();

// Type-safe API object for modern usage
export const api = trpc;
