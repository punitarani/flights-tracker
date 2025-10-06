import type { Alert } from "@/db/schema";
import { getDefaultAlertDateRangeIso } from "./alert-defaults";
import type { AlertType } from "./alert-types";
import {
  createAlert,
  deleteAlert,
  getAlertById,
  getAlertsByUser,
  updateAlert,
  validateAirlineExists,
  validateAirportExists,
} from "./alerts-db";
import { AlertNotFoundError, AlertValidationError } from "./errors";
import {
  type AlertFilterCriteria,
  type AlertFilters,
  AlertFiltersSchema,
} from "./filters";
import type { CreateAlertInput, UpdateAlertInput } from "./types";

/**
 * Validates alert filters and ensures airports/airlines exist
 * @param filters - The alert filters to validate
 * @throws AlertValidationError if validation fails
 */
export async function validateAlertFilters(data: AlertFilters): Promise<void> {
  // Validate filters schema first
  const parseResult = AlertFiltersSchema.safeParse(data);
  if (!parseResult.success) {
    throw new AlertValidationError(
      `Invalid filter format: ${parseResult.error.message}`,
    );
  }

  const validFilters = parseResult.data;
  const route = validFilters.route;
  const criteria: AlertFilterCriteria = validFilters.filters ?? {};

  if (criteria.dateFrom || criteria.dateTo) {
    if (!criteria.dateFrom || !criteria.dateTo) {
      throw new AlertValidationError(
        "Both dateFrom and dateTo are required when specifying a date range",
        "dateRange",
      );
    }

    const fromDate = new Date(criteria.dateFrom);
    const toDate = new Date(criteria.dateTo);

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new AlertValidationError(
        "Invalid alert date range format",
        "dateRange",
      );
    }

    if (fromDate > toDate) {
      throw new AlertValidationError(
        "dateFrom must be on or before dateTo",
        "dateRange",
      );
    }
  }

  // Validate origin airport exists
  const fromExists = await validateAirportExists(route.from);
  if (!fromExists) {
    throw new AlertValidationError(
      `Origin airport '${route.from}' not found`,
      "from",
    );
  }

  // Validate destination airport exists
  const toExists = await validateAirportExists(route.to);
  if (!toExists) {
    throw new AlertValidationError(
      `Destination airport '${route.to}' not found`,
      "to",
    );
  }

  // Validate airlines if specified
  if (criteria.airlines && criteria.airlines.length > 0) {
    for (const airlineCode of criteria.airlines) {
      const airlineExists = await validateAirlineExists(airlineCode);
      if (!airlineExists) {
        throw new AlertValidationError(
          `Airline '${airlineCode}' not found`,
          "airlines",
        );
      }
    }
  }

  // Additional business logic validation
  if (route.from === route.to) {
    throw new AlertValidationError(
      "Origin and destination airports cannot be the same",
      "to",
    );
  }

  if (criteria.price && criteria.price <= 0) {
    throw new AlertValidationError("Price must be a positive number", "price");
  }
}

/**
 * Creates a new flight alert with validation
 * @param userId - The user ID creating the alert
 * @param filters - The alert filters
 * @param alertEnd - Optional end date for the alert
 * @returns The created alert
 * @throws AlertValidationError if validation fails
 */
export async function createFlightAlert(
  userId: string,
  type: AlertType,
  data: AlertFilters,
  alertEnd?: string,
): Promise<Alert> {
  if (!userId?.trim()) {
    throw new AlertValidationError("User ID is required");
  }

  const filtersWithDefaults: AlertFilters = {
    ...data,
    route: { ...data.route },
    filters: { ...(data.filters ?? {}) },
  };

  if (
    !filtersWithDefaults.filters?.dateFrom ||
    !filtersWithDefaults.filters?.dateTo
  ) {
    const { dateFrom, dateTo } = getDefaultAlertDateRangeIso();
    filtersWithDefaults.filters = {
      ...filtersWithDefaults.filters,
      dateFrom,
      dateTo,
    };
  }

  // Validate filters and check airports/airlines exist
  await validateAlertFilters(filtersWithDefaults);

  // Validate alert end date if provided
  if (alertEnd) {
    const endDate = new Date(alertEnd);
    const now = new Date();

    if (Number.isNaN(endDate.getTime())) {
      throw new AlertValidationError("Invalid alert end date format");
    }

    if (endDate <= now) {
      throw new AlertValidationError("Alert end date must be in the future");
    }
  }

  const input: CreateAlertInput = {
    userId,
    type,
    filters: filtersWithDefaults,
    alertEnd,
  };

  return await createAlert(input);
}

/**
 * Retrieves an alert by ID with user verification
 * @param alertId - The alert ID
 * @param userId - The user ID (for ownership verification)
 * @returns The alert if found and owned by user
 * @throws AlertNotFoundError if not found or not owned by user
 */
export async function getFlightAlert(
  alertId: string,
  userId: string,
): Promise<Alert> {
  if (!alertId?.trim() || !userId?.trim()) {
    throw new AlertValidationError("Alert ID and user ID are required");
  }

  const alert = await getAlertById(alertId);

  if (!alert) {
    throw new AlertNotFoundError(alertId);
  }

  if (alert.userId !== userId) {
    throw new AlertNotFoundError(alertId); // Don't reveal existence of other users' alerts
  }

  return alert;
}

/**
 * Gets all alerts for a user with optional status filter
 * @param userId - The user ID
 * @param status - Optional status filter
 * @returns Array of user's alerts
 */
export async function getUserAlerts(
  userId: string,
  status?: "active" | "completed" | "deleted",
): Promise<Alert[]> {
  if (!userId?.trim()) {
    throw new AlertValidationError("User ID is required");
  }

  return await getAlertsByUser(userId, status);
}

/**
 * Updates an alert with validation
 * @param alertId - The alert ID
 * @param userId - The user ID (for ownership verification)
 * @param updates - Fields to update
 * @returns The updated alert
 * @throws AlertNotFoundError if not found or not owned by user
 * @throws AlertValidationError if validation fails
 */
export async function updateFlightAlert(
  alertId: string,
  userId: string,
  updates: UpdateAlertInput,
): Promise<Alert> {
  if (!alertId?.trim() || !userId?.trim()) {
    throw new AlertValidationError("Alert ID and user ID are required");
  }

  // Verify alert exists and user owns it
  await getFlightAlert(alertId, userId);

  // Validate alert end date if being updated
  if (updates.alertEnd) {
    const endDate = new Date(updates.alertEnd);
    const now = new Date();

    if (Number.isNaN(endDate.getTime())) {
      throw new AlertValidationError("Invalid alert end date format");
    }

    if (endDate <= now) {
      throw new AlertValidationError("Alert end date must be in the future");
    }
  }

  const result = await updateAlert(alertId, updates);

  if (!result) {
    throw new AlertNotFoundError(alertId);
  }

  return result;
}

/**
 * Deletes (soft delete) an alert
 * @param alertId - The alert ID
 * @param userId - The user ID (for ownership verification)
 * @returns True if successfully deleted
 * @throws AlertNotFoundError if not found or not owned by user
 */
export async function deleteFlightAlert(
  alertId: string,
  userId: string,
): Promise<boolean> {
  if (!alertId?.trim() || !userId?.trim()) {
    throw new AlertValidationError("Alert ID and user ID are required");
  }

  // Verify alert exists and user owns it
  await getFlightAlert(alertId, userId);

  return await deleteAlert(alertId);
}

/**
 * Activates an alert (sets status to active)
 * @param alertId - The alert ID
 * @param userId - The user ID
 * @returns The updated alert
 */
export async function activateAlert(
  alertId: string,
  userId: string,
): Promise<Alert> {
  return await updateFlightAlert(alertId, userId, { status: "active" });
}

/**
 * Completes an alert (sets status to completed)
 * @param alertId - The alert ID
 * @param userId - The user ID
 * @returns The updated alert
 */
export async function completeAlert(
  alertId: string,
  userId: string,
): Promise<Alert> {
  return await updateFlightAlert(alertId, userId, { status: "completed" });
}

/**
 * Gets statistics about a user's alerts
 * @param userId - The user ID
 * @returns Alert statistics
 */
export async function getUserAlertStats(userId: string): Promise<{
  total: number;
  active: number;
  completed: number;
  deleted: number;
}> {
  if (!userId?.trim()) {
    throw new AlertValidationError("User ID is required");
  }

  const [allAlerts, activeAlerts, completedAlerts, deletedAlerts] =
    await Promise.all([
      getAlertsByUser(userId),
      getAlertsByUser(userId, "active"),
      getAlertsByUser(userId, "completed"),
      getAlertsByUser(userId, "deleted"),
    ]);

  return {
    total: allAlerts.length,
    active: activeAlerts.length,
    completed: completedAlerts.length,
    deleted: deletedAlerts.length,
  };
}
