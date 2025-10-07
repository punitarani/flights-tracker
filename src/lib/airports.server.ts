import "server-only";

import { cache } from "react";

import { searchAirports } from "@/server/services/airports";

const DEFAULT_HOME_LIMIT = 10000;

export const getCachedAirports = cache(async () => {
  return searchAirports({ limit: DEFAULT_HOME_LIMIT });
});
