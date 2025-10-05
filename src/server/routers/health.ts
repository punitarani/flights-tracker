import { createRouter } from "../trpc";

export const healthRouter = createRouter().query("ping", {
  resolve: () => ({ status: "ok" }),
});
