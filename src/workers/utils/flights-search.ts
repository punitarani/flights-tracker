/**
 * Flight data fetcher for Cloudflare Workers
 * Fetches flight data from Next.js API with parallel execution for optimal performance
 */

import type { Alert } from "@/db/schema";
import type { FlightOption } from "@/server/services/flights";
import type { WorkerEnv } from "../env";
import { workerLogger } from "./logger";

/** Alert paired with its matching flight options */
interface AlertWithFlights {
  alert: Alert;
  flights: FlightOption[];
}

/**
 * Constructs the Next.js API URL with all alert filter parameters
 * @param env - Worker environment with NEXTJS_API_URL
 * @param alert - Alert with route and filter criteria
 * @returns Fully constructed API URL with query parameters
 */
function buildFlightApiUrl(env: WorkerEnv, alert: Alert): string {
  const { route, filters } = alert.filters;
  const params = new URLSearchParams();

  params.set("origin", route.from);
  params.set("destination", route.to);

  if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters?.dateTo) params.set("dateTo", filters.dateTo);
  if (filters?.class) params.set("seatType", filters.class);
  if (filters?.stops) params.set("stops", filters.stops);
  if (filters?.airlines && filters.airlines.length > 0) {
    params.set("airlines", filters.airlines.join(","));
  }
  if (filters?.price) params.set("maxPrice", filters.price.toString());

  const baseUrl = env.NEXTJS_API_URL || "http://localhost:3000";
  return `${baseUrl}/api/flights?${params.toString()}`;
}

/**
 * Fetches and filters flight data for a single alert
 * @param env - Worker environment
 * @param alert - Alert to fetch flights for
 * @param maxFlights - Maximum number of flights to return
 * @returns Alert with flights, or null if fetch fails or no flights match
 */
async function fetchFlightsForAlert(
  env: WorkerEnv,
  alert: Alert,
  maxFlights: number,
): Promise<AlertWithFlights | null> {
  try {
    const url = buildFlightApiUrl(env, alert);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as { flights?: FlightOption[] };
    const flights = (data.flights || []).slice(0, maxFlights);

    const matchingFlights = alert.filters.filters?.price
      ? flights.filter(
          (f) => f.totalPrice <= (alert.filters.filters?.price || Infinity),
        )
      : flights;

    return {
      alert,
      flights: matchingFlights,
    };
  } catch (error) {
    workerLogger.error("Failed to fetch flights for alert", {
      alertId: alert.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Fetches flight data for multiple alerts in parallel
 * Gracefully handles individual alert failures without blocking others
 * @param env - Worker environment
 * @param alerts - Array of alerts to fetch flights for
 * @param maxFlights - Maximum flights per alert
 * @returns Array of alerts with their matching flights (excludes failed fetches)
 */
export async function fetchFlightDataFromAPI(
  env: WorkerEnv,
  alerts: Alert[],
  maxFlights: number,
): Promise<AlertWithFlights[]> {
  if (alerts.length === 0) return [];

  workerLogger.info("Fetching flights for alerts", {
    alertCount: alerts.length,
  });

  const results = await Promise.all(
    alerts.map((alert) => fetchFlightsForAlert(env, alert, maxFlights)),
  );

  const successfulResults = results.filter(
    (result): result is AlertWithFlights =>
      result !== null && result.flights.length > 0,
  );

  workerLogger.info("Fetched flights", {
    totalAlerts: alerts.length,
    successfulCount: successfulResults.length,
  });

  return successfulResults;
}
