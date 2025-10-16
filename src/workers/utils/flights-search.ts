import {
  type AlertWithFlights,
  fetchFlightDataForAlerts as fetchCoreFlightDataForAlerts,
} from "@/core/alert-flight-fetcher";
import type { Alert } from "@/db/schema";
import type { WorkerEnv } from "../env";
import { workerLogger } from "./logger";

export async function fetchFlightDataForAlerts(
  _env: WorkerEnv,
  alerts: Alert[],
  maxFlights: number,
  fetcher: typeof fetchCoreFlightDataForAlerts = fetchCoreFlightDataForAlerts,
): Promise<AlertWithFlights[]> {
  if (alerts.length === 0) return [];

  workerLogger.info("Fetching flights for alerts", {
    alertCount: alerts.length,
  });

  const results = await fetcher(alerts, maxFlights);

  workerLogger.info("Fetched flights", {
    totalAlerts: alerts.length,
    successfulCount: results.length,
  });

  return results;
}
