import type { Alert } from "@/db/schema";
import { logger } from "@/lib/logger";
import { sendNotificationEmail } from "@/lib/notifications";
import type {
  AlertDescriptor,
  DailyAlertSummary,
  DailyPriceUpdateEmail,
  NotificationSendRequest,
} from "@/lib/notifications/types";
import { createServiceClient } from "@/lib/supabase/service";
import type { FlightOption } from "@/server/services/flights";
import {
  type AlertWithFlights,
  fetchFlightDataForAlerts,
} from "./alert-flight-fetcher";
import { AlertType } from "./alert-types";
import { getAirportByIata, updateAlert } from "./alerts.db";
import { getUserAlerts } from "./alerts-service";
import {
  createNotificationWithAlerts,
  hasAlertBeenProcessedRecently,
} from "./notifications.db";

/**
 * Main alert processing service
 * Orchestrates the processing of daily alerts for users
 */

const DEDUPLICATION_HOURS = 23;
const MAX_FLIGHTS_PER_ALERT = 5;

/**
 * Filters out alerts that have been processed recently
 * @param alerts - Array of alerts to filter
 * @returns Array of alerts that haven't been processed recently
 */
async function filterUnprocessedAlerts(alerts: Alert[]): Promise<Alert[]> {
  const checkPromises = alerts.map(async (alert) => {
    const processed = await hasAlertBeenProcessedRecently(
      alert.id,
      DEDUPLICATION_HOURS,
    );
    return { alert, processed };
  });

  const results = await Promise.all(checkPromises);
  const unprocessed = results.filter((r) => !r.processed).map((r) => r.alert);

  logger.info("Filtered alerts to unprocessed subset", {
    originalCount: alerts.length,
    unprocessedCount: unprocessed.length,
  });

  return unprocessed;
}

/**
 * Checks and updates expired alerts to completed status
 * @param alerts - Array of alerts to check
 * @returns Array of alerts that are still active (not expired)
 */
async function filterAndUpdateExpiredAlerts(alerts: Alert[]): Promise<Alert[]> {
  const now = new Date();
  const activeAlerts: Alert[] = [];
  const expiredAlerts: Alert[] = [];

  for (const alert of alerts) {
    if (alert.alertEnd) {
      const endDate = new Date(alert.alertEnd);
      if (endDate <= now) {
        expiredAlerts.push(alert);
      } else {
        activeAlerts.push(alert);
      }
    } else {
      activeAlerts.push(alert);
    }
  }

  // Update expired alerts to completed status
  if (expiredAlerts.length > 0) {
    logger.info("Marking expired alerts as completed", {
      expiredCount: expiredAlerts.length,
    });
    await Promise.all(
      expiredAlerts.map((alert) =>
        updateAlert(alert.id, { status: "completed" }),
      ),
    );
  }

  return activeAlerts;
}

/**
 * Converts alert filters to a human-readable descriptor
 * @param alert - Alert to convert
 * @returns AlertDescriptor for email template
 */
async function convertAlertToDescriptor(
  alert: Alert,
): Promise<AlertDescriptor> {
  const { route, filters } = alert.filters;

  // Get airport names
  const fromAirport = await getAirportByIata(route.from);
  const toAirport = await getAirportByIata(route.to);

  const fromName = fromAirport
    ? `${fromAirport.city} (${fromAirport.iata})`
    : route.from;
  const toName = toAirport ? `${toAirport.city} (${toAirport.iata})` : route.to;

  const descriptor: AlertDescriptor = {
    id: alert.id,
    label: `${fromName} to ${toName}`,
    origin: fromName,
    destination: toName,
  };

  // Add seat type
  if (filters?.class) {
    descriptor.seatType = filters.class
      .split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");
  }

  // Add stops
  if (filters?.stops) {
    descriptor.stops =
      filters.stops === "NONSTOP"
        ? "Nonstop"
        : filters.stops === "ONE_STOP"
          ? "1 stop max"
          : filters.stops === "TWO_STOPS"
            ? "2 stops max"
            : "Any stops";
  }

  // Add airlines
  if (filters?.airlines && filters.airlines.length > 0) {
    descriptor.airlines = filters.airlines;
  }

  // Add price limit
  if (filters?.price) {
    descriptor.priceLimit = {
      amount: filters.price,
      currency: "USD", // Default currency
    };
  }

  return descriptor;
}

/**
 * Formats alerts with flights for email notification
 * @param alertsWithFlights - Array of alerts with their flight data
 * @returns Array of DailyAlertSummary for email template
 */
async function formatAlertsForEmail(
  alertsWithFlights: AlertWithFlights[],
): Promise<DailyAlertSummary[]> {
  const summaries: DailyAlertSummary[] = [];

  for (const { alert, flights } of alertsWithFlights) {
    const descriptor = await convertAlertToDescriptor(alert);

    summaries.push({
      alert: descriptor,
      flights: flights,
      generatedAt: new Date().toISOString(),
    });
  }

  return summaries;
}

/**
 * Gets user email from Supabase
 * @param userId - User ID
 * @returns User email or null if not found
 */
async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.auth.admin.getUserById(userId);

    if (error) {
      logger.error("Failed to get user email", { userId, error });
      return null;
    }

    return data.user.email ?? null;
  } catch (error) {
    logger.error("Error getting user email", { userId, error });
    return null;
  }
}

/**
 * Records notification sent to database
 * @param userId - User ID
 * @param userEmail - User email
 * @param alertsWithFlights - Alerts that were sent
 * @param subject - Email subject
 * @param status - Send status
 * @param errorMessage - Optional error message
 */
async function recordNotificationSent(
  userId: string,
  userEmail: string,
  alertsWithFlights: AlertWithFlights[],
  subject: string,
  status: "sent" | "failed",
  errorMessage?: string,
): Promise<void> {
  try {
    // Create flight data map
    const flightDataMap = new Map<string, FlightOption[]>();
    for (const { alert, flights } of alertsWithFlights) {
      flightDataMap.set(alert.id, flights);
    }

    // Create notification with associated alerts
    await createNotificationWithAlerts(
      {
        userId,
        type: "daily",
        recipient: userEmail,
        subject,
        status,
        errorMessage,
      },
      alertsWithFlights.map((a) => a.alert.id),
      flightDataMap,
    );

    logger.info("Recorded notification with alerts", {
      userId,
      status,
      alertsCount: alertsWithFlights.length,
    });
  } catch (error) {
    logger.error("Failed to record notification", { userId, error });
  }
}

/**
 * Processes daily alerts for a specific user
 * @param userId - User ID to process alerts for
 * @returns True if processing was successful, false otherwise
 */
export async function processDailyAlertsForUser(
  userId: string,
): Promise<boolean> {
  logger.info("Starting alert processing for user", { userId });

  try {
    // 1. Get user email
    const userEmail = await getUserEmail(userId);
    if (!userEmail) {
      logger.warn("No email found for user", { userId });
      return false;
    }

    // 2. Get all active daily alerts for user
    const allAlerts = await getUserAlerts(userId, "active");
    const dailyAlerts = allAlerts.filter(
      (alert) => alert.type === AlertType.DAILY,
    );

    logger.info("Found daily alerts for user", {
      userId,
      alertsCount: dailyAlerts.length,
    });

    if (dailyAlerts.length === 0) {
      logger.info("No daily alerts to process", { userId });
      return true;
    }

    // 3. Filter out expired alerts and update them to completed
    const nonExpiredAlerts = await filterAndUpdateExpiredAlerts(dailyAlerts);

    if (nonExpiredAlerts.length === 0) {
      logger.info("All alerts expired for user", { userId });
      return true;
    }

    // 4. Filter out recently processed alerts
    const alertsToProcess = await filterUnprocessedAlerts(nonExpiredAlerts);

    if (alertsToProcess.length === 0) {
      logger.info("No new alerts to process", { userId });
      return true;
    }

    // 5. Fetch flight data for alerts
    logger.info("Fetching flight data for alerts", {
      userId,
      alertsCount: alertsToProcess.length,
    });
    const alertsWithFlights = await fetchFlightDataForAlerts(
      alertsToProcess,
      MAX_FLIGHTS_PER_ALERT,
    );

    // 6. If no valid alerts with flights, skip sending email but record the attempt
    if (alertsWithFlights.length === 0) {
      logger.info("No matching flights found", { userId });

      // Record failed notification for deduplication
      await recordNotificationSent(
        userId,
        userEmail,
        [],
        "Daily flight alerts - No matches",
        "failed",
        "No matching flights found",
      );

      return true;
    }

    // 7. Format data for email
    const alertSummaries = await formatAlertsForEmail(alertsWithFlights);

    const payload: DailyPriceUpdateEmail = {
      type: "daily-price-update",
      summaryDate: new Date().toISOString().split("T")[0],
      alerts: alertSummaries,
    };

    const notificationRequest: NotificationSendRequest = {
      recipient: {
        email: userEmail,
      },
      payload,
    };

    // 8. Send email
    logger.info("Sending daily alert email", {
      userId,
      userEmail,
      alertsCount: alertsWithFlights.length,
    });

    try {
      const _result = await sendNotificationEmail(notificationRequest);

      // 9. Record successful notification
      await recordNotificationSent(
        userId,
        userEmail,
        alertsWithFlights,
        `Daily flight alerts for ${payload.summaryDate}`,
        "sent",
      );

      logger.info("Successfully processed alerts for user", { userId });
      return true;
    } catch (emailError) {
      logger.error("Failed to send notification email", {
        userId,
        userEmail,
        error: emailError,
      });

      // Record failed notification
      await recordNotificationSent(
        userId,
        userEmail,
        alertsWithFlights,
        `Daily flight alerts for ${payload.summaryDate}`,
        "failed",
        emailError instanceof Error ? emailError.message : "Email send failed",
      );

      return false;
    }
  } catch (error) {
    logger.error("Error processing alerts for user", { userId, error });
    return false;
  }
}

/**
 * Processes daily alerts for multiple users
 * @param userIds - Array of user IDs to process
 * @returns Object with successful and failed user IDs
 */
export async function processDailyAlertsForUsers(
  userIds: string[],
): Promise<{ successful: string[]; failed: string[] }> {
  const successful: string[] = [];
  const failed: string[] = [];

  for (const userId of userIds) {
    const success = await processDailyAlertsForUser(userId);
    if (success) {
      successful.push(userId);
    } else {
      failed.push(userId);
    }
  }

  return { successful, failed };
}
