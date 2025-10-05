import { createReactQueryHooks } from "@trpc/react";

import type { AppRouter } from "@/server/routers/app";

export const trpc = createReactQueryHooks<AppRouter>();
