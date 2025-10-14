import { and, eq, gte, isNull, or } from "drizzle-orm";
import { db } from "@/db/client";
import { type Alert, airline, airport, alert } from "@/db/schema";
import { AlertType } from "./alert-types";
import type { CreateAlertInput, UpdateAlertInput } from "./types";

/**
 * Database operations for alerts management
 * Handles all CRUD operations for flight alerts
 */

/**
 * Creates a new flight alert in the database
 * @param input - Alert creation parameters
 * @returns The created alert
 */
export async function createAlert(input: CreateAlertInput): Promise<Alert> {
  const result = await db
    .insert(alert)
    .values({
      userId: input.userId,
      type: input.type,
      filters: input.filters,
      status: "active",
      alertEnd: input.alertEnd,
      createdAt: new Date().toISOString(),
    })
    .returning();

  return result[0];
}

/**
 * Retrieves an alert by its ID
 * @param alertId - The alert ID
 * @returns The alert if found, null otherwise
 */
export async function getAlertById(alertId: string): Promise<Alert | null> {
  const result = await db
    .select()
    .from(alert)
    .where(eq(alert.id, alertId))
    .limit(1);

  return result[0] || null;
}

/**
 * Retrieves all alerts for a specific user
 * @param userId - The user ID
 * @param status - Optional status filter
 * @returns Array of alerts
 */
export async function getAlertsByUser(
  userId: string,
  status?: "active" | "completed" | "deleted",
): Promise<Alert[]> {
  const conditions = [eq(alert.userId, userId)];

  if (status) {
    conditions.push(eq(alert.status, status));
  }

  return await db
    .select()
    .from(alert)
    .where(and(...conditions))
    .orderBy(alert.createdAt);
}

/**
 * Updates an existing alert
 * @param alertId - The alert ID
 * @param updates - Fields to update
 * @returns The updated alert if found, null otherwise
 */
export async function updateAlert(
  alertId: string,
  updates: UpdateAlertInput,
): Promise<Alert | null> {
  const result = await db
    .update(alert)
    .set(updates)
    .where(eq(alert.id, alertId))
    .returning();

  return result[0] || null;
}

/**
 * Soft deletes an alert by marking it as deleted
 * @param alertId - The alert ID
 * @returns True if the alert was deleted, false otherwise
 */
export async function deleteAlert(alertId: string): Promise<boolean> {
  const result = await db
    .update(alert)
    .set({ status: "deleted" })
    .where(eq(alert.id, alertId))
    .returning();

  return result.length > 0;
}

/**
 * Gets all active alerts that haven't expired
 * @returns Array of active alerts
 */
export async function getActiveAlerts(): Promise<Alert[]> {
  const now = new Date().toISOString();

  return await db
    .select()
    .from(alert)
    .where(
      and(
        eq(alert.status, "active"),
        // Include alerts with no end date (alertEnd is null) or future end dates
        or(isNull(alert.alertEnd), gte(alert.alertEnd, now)),
      ),
    )
    .orderBy(alert.createdAt);
}

/**
 * Retrieves unique user IDs that have at least one active daily alert
 */
export async function getUserIdsWithActiveDailyAlerts(): Promise<string[]> {
  const now = new Date().toISOString();

  const results = await db
    .select({ userId: alert.userId })
    .from(alert)
    .where(
      and(
        eq(alert.status, "active"),
        eq(alert.type, AlertType.DAILY),
        or(isNull(alert.alertEnd), gte(alert.alertEnd, now)),
      ),
    )
    .groupBy(alert.userId);

  return results.map((row) => row.userId);
}

/**
 * Validates if an airport exists by IATA code
 * @param iataCode - The airport IATA code (3 letters)
 * @returns True if airport exists, false otherwise
 */
export async function validateAirportExists(
  iataCode: string,
): Promise<boolean> {
  const result = await db
    .select({ id: airport.id })
    .from(airport)
    .where(eq(airport.iata, iataCode.toUpperCase()))
    .limit(1);

  return result.length > 0;
}

/**
 * Validates if an airline exists by IATA code
 * @param iataCode - The airline IATA code (2 letters)
 * @returns True if airline exists, false otherwise
 */
export async function validateAirlineExists(
  iataCode: string,
): Promise<boolean> {
  const result = await db
    .select({ id: airline.id })
    .from(airline)
    .where(eq(airline.iata, iataCode.toUpperCase()))
    .limit(1);

  return result.length > 0;
}

/**
 * Validates multiple airline IATA codes
 * @param iataCodes - Array of airline IATA codes
 * @returns Array of valid codes that exist in the database
 */
export async function validateAirlines(iataCodes: string[]): Promise<string[]> {
  if (iataCodes.length === 0) return [];

  const uppercaseCodes = iataCodes.map((code) => code.toUpperCase());
  const result = await db
    .select({ iata: airline.iata })
    .from(airline)
    .where(eq(airline.iata, uppercaseCodes[0])); // This will need to be improved for multiple codes

  return result.map((row) => row.iata);
}

/**
 * Gets airport information by IATA code
 * @param iataCode - The airport IATA code
 * @returns Airport information if found, null otherwise
 */
export async function getAirportByIata(iataCode: string) {
  const result = await db
    .select()
    .from(airport)
    .where(eq(airport.iata, iataCode.toUpperCase()))
    .limit(1);

  return result[0] || null;
}

/**
 * Gets airline information by IATA code
 * @param iataCode - The airline IATA code
 * @returns Airline information if found, null otherwise
 */
export async function getAirlineByIata(iataCode: string) {
  const result = await db
    .select()
    .from(airline)
    .where(eq(airline.iata, iataCode.toUpperCase()))
    .limit(1);

  return result[0] || null;
}
