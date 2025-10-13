/**
 * Alert processing adapter for Cloudflare Workers
 * Wraps and adapts the existing alert processing logic from src/core/
 */

import { desc, eq } from "drizzle-orm";
import { AlertType } from "@/core/alert-types";
import {
  getAirportByIata,
  getAlertsByUser,
  updateAlert,
} from "@/core/alerts-db";
import {
  createNotificationWithAlerts,
  hasAlertBeenProcessedRecently,
} from "@/core/notifications-db";
import type { Alert } from "@/db/schema";
import { notification } from "@/db/schema";
import { sendNotificationEmail } from "@/lib/notifications";
import type {
  AlertDescriptor,
  DailyAlertSummary,
  DailyPriceUpdateEmail,
  NotificationSendRequest,
} from "@/lib/notifications/types";
import type { FlightOption } from "@/server/services/flights";
import { getWorkerDb } from "../db";
import type { WorkerEnv } from "../env";
import { fetchFlightDataFromAPI } from "../utils/flights-search";
import { workerLogger } from "../utils/logger";
import { addBreadcrumb, captureException } from "../utils/sentry";
import { getUserEmail } from "../utils/user";

const DEDUPLICATION_HOURS = 23;
const MAX_FLIGHTS_PER_ALERT = 5;

interface AlertWithFlights {
  alert: Alert;
  flights: FlightOption[];
}

/**
 * Checks if email can be sent based on time window and last notification
 */
async function checkEmailEligibility(
  env: WorkerEnv,
  userId: string,
): Promise<{ canSend: boolean; reason?: string }> {
  const db = getWorkerDb(env);
  const now = new Date();
  const hourUTC = now.getUTCHours();

  // Must be 6-9 PM UTC (18:00-21:59)
  const isInTimeWindow = hourUTC >= 18 && hourUTC < 22;

  if (!isInTimeWindow) {
    return {
      canSend: false,
      reason: `outside-time-window (current hour: ${hourUTC} UTC)`,
    };
  }

  // Check last notification from DB
  const [lastNotification] = await db
    .select()
    .from(notification)
    .where(eq(notification.userId, userId))
    .orderBy(desc(notification.sentAt))
    .limit(1);

  if (!lastNotification) {
    return { canSend: true };
  }

  const lastSentTime = new Date(lastNotification.sentAt).getTime();
  const timeSinceLastEmail = now.getTime() - lastSentTime;
  const hoursSinceLastEmail = timeSinceLastEmail / (60 * 60 * 1000);

  if (hoursSinceLastEmail < 24) {
    return {
      canSend: false,
      reason: `email-sent-recently (${Math.floor(hoursSinceLastEmail)}h ago)`,
    };
  }

  return { canSend: true };
}

/**
 * Filters out alerts that have been processed recently (parallelized for performance)
 */
async function filterUnprocessedAlerts(alerts: Alert[]): Promise<Alert[]> {
  // Check all alerts in parallel for optimal performance
  const results = await Promise.all(
    alerts.map(async (alert) => ({
      alert,
      processed: await hasAlertBeenProcessedRecently(
        alert.id,
        DEDUPLICATION_HOURS,
      ),
    })),
  );

  const unprocessed = results.filter((r) => !r.processed).map((r) => r.alert);

  workerLogger.info("Filtered alerts to unprocessed subset", {
    originalCount: alerts.length,
    unprocessedCount: unprocessed.length,
  });

  return unprocessed;
}

/**
 * Checks and updates expired alerts (parallelized DB updates)
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

  // Update all expired alerts in parallel for optimal performance
  if (expiredAlerts.length > 0) {
    workerLogger.info("Marking expired alerts as completed", {
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
 * Converts alert to descriptor for email (parallelized airport lookups)
 */
async function convertAlertToDescriptor(
  alert: Alert,
): Promise<AlertDescriptor> {
  const { route, filters } = alert.filters;

  // Fetch both airports in parallel
  const [fromAirport, toAirport] = await Promise.all([
    getAirportByIata(route.from),
    getAirportByIata(route.to),
  ]);

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

  if (filters?.class) {
    descriptor.seatType = filters.class
      .split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");
  }

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

  if (filters?.airlines && filters.airlines.length > 0) {
    descriptor.airlines = filters.airlines;
  }

  if (filters?.price) {
    descriptor.priceLimit = {
      amount: filters.price,
      currency: "USD",
    };
  }

  return descriptor;
}

/**
 * Formats alerts with flights for email (parallelized airport lookups)
 */
async function formatAlertsForEmail(
  alertsWithFlights: AlertWithFlights[],
): Promise<DailyAlertSummary[]> {
  // Convert all alerts in parallel for optimal performance
  const summaries = await Promise.all(
    alertsWithFlights.map(async ({ alert, flights }) => ({
      alert: await convertAlertToDescriptor(alert),
      flights,
      generatedAt: new Date().toISOString(),
    })),
  );

  return summaries;
}

/**
 * Records notification to database (non-blocking error handling)
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
    const flightDataMap = new Map<string, FlightOption[]>();
    for (const { alert, flights } of alertsWithFlights) {
      flightDataMap.set(alert.id, flights);
    }

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

    workerLogger.info("Recorded notification", {
      userId,
      status,
      alertsCount: alertsWithFlights.length,
    });
  } catch (error) {
    workerLogger.error("Failed to record notification", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Main processing function for a user's daily alerts
 */
export async function processDailyAlertsForUser(
  env: WorkerEnv,
  userId: string,
): Promise<{ success: boolean; reason?: string }> {
  workerLogger.info("Starting alert processing for user", { userId });
  addBreadcrumb("Starting alert processing", { userId });

  try {
    // 1. Check email eligibility (time window + 24h limit)
    const eligibility = await checkEmailEligibility(env, userId);
    if (!eligibility.canSend) {
      workerLogger.info("Skipping - not eligible for email", {
        userId,
        reason: eligibility.reason,
      });
      addBreadcrumb("Skipped email send", { reason: eligibility.reason });
      return { success: true, reason: eligibility.reason };
    }

    // 2. Get user email
    const userEmail = await getUserEmail(env, userId);
    if (!userEmail) {
      workerLogger.warn("No email found for user", { userId });
      captureException(new Error("No email found for user"), { userId });
      return { success: false, reason: "no-email" };
    }

    addBreadcrumb("User email fetched", { userId });

    // 3. Get active daily alerts (reuse existing function)
    const allAlerts = await getAlertsByUser(userId, "active");
    const dailyAlerts = allAlerts.filter(
      (alert) => alert.type === AlertType.DAILY,
    );

    workerLogger.info("Found daily alerts", {
      userId,
      alertsCount: dailyAlerts.length,
    });

    if (dailyAlerts.length === 0) {
      return { success: true, reason: "no-alerts" };
    }

    // 4. Filter expired alerts (updates DB in parallel)
    const nonExpiredAlerts = await filterAndUpdateExpiredAlerts(dailyAlerts);
    if (nonExpiredAlerts.length === 0) {
      return { success: true, reason: "all-expired" };
    }

    // 5. Filter recently processed alerts (checks DB in parallel)
    const alertsToProcess = await filterUnprocessedAlerts(nonExpiredAlerts);
    if (alertsToProcess.length === 0) {
      return { success: true, reason: "all-recently-processed" };
    }

    // 6. Fetch flight data via Next.js API
    workerLogger.info("Fetching flight data", {
      userId,
      alertsCount: alertsToProcess.length,
    });

    const alertsWithFlights = await fetchFlightDataFromAPI(
      env,
      alertsToProcess,
      MAX_FLIGHTS_PER_ALERT,
    );

    if (alertsWithFlights.length === 0) {
      workerLogger.info("No matching flights found", { userId });

      await recordNotificationSent(
        userId,
        userEmail,
        [],
        "Daily flight alerts - No matches",
        "failed",
        "No matching flights found",
      );

      return { success: true, reason: "no-flights" };
    }

    // 7. Format and send email
    const alertSummaries = await formatAlertsForEmail(alertsWithFlights);

    const payload: DailyPriceUpdateEmail = {
      type: "daily-price-update",
      summaryDate: new Date().toISOString().split("T")[0],
      alerts: alertSummaries,
    };

    const notificationRequest: NotificationSendRequest = {
      recipient: { email: userEmail },
      payload,
    };

    workerLogger.info("Sending email", {
      userId,
      userEmail,
      alertsCount: alertsWithFlights.length,
    });

    try {
      await sendNotificationEmail(notificationRequest);
      addBreadcrumb("Email sent successfully", {
        userId,
        alertCount: alertsWithFlights.length,
      });

      await recordNotificationSent(
        userId,
        userEmail,
        alertsWithFlights,
        `Daily flight alerts for ${payload.summaryDate}`,
        "sent",
      );

      workerLogger.info("Successfully processed alerts", { userId });
      return { success: true };
    } catch (emailError) {
      workerLogger.error("Failed to send email", {
        userId,
        error:
          emailError instanceof Error ? emailError.message : String(emailError),
      });

      captureException(emailError, {
        userId,
        userEmail,
        alertCount: alertsWithFlights.length,
        operation: "send-email",
      });

      await recordNotificationSent(
        userId,
        userEmail,
        alertsWithFlights,
        `Daily flight alerts for ${payload.summaryDate}`,
        "failed",
        emailError instanceof Error ? emailError.message : "Email send failed",
      );

      return { success: false, reason: "email-failed" };
    }
  } catch (error) {
    workerLogger.error("Error processing alerts", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });

    captureException(error, {
      userId,
      operation: "process-daily-alerts",
    });

    return { success: false, reason: "processing-error" };
  }
}
