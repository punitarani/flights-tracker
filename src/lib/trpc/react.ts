import { createTRPCReact } from "@trpc/react-query";

import type { AppRouter } from "@/server/routers/app";

export const api = createTRPCReact<AppRouter>();
