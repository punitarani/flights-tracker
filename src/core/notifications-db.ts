import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db/client";
import {
  type AlertNotification,
  alertNotification,
  type Notification,
  notification,
} from "@/db/schema";
import type { FlightOption } from "@/server/services/flights";

/**
 * Database operations for notifications management
 * Handles CRUD operations for notification and alert_notification tables
 */

export interface CreateNotificationInput {
  userId: string;
  type: "daily" | "price-drop";
  recipient: string;
  subject: string;
  status: "sent" | "failed";
  errorMessage?: string;
}

export interface CreateAlertNotificationInput {
  notificationId: string;
  alertId: string;
  flightDataSnapshot?: FlightOption[];
}

/**
 * Creates a new notification record
 * @param input - Notification creation parameters
 * @returns The created notification
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<Notification> {
  const result = await db
    .insert(notification)
    .values({
      userId: input.userId,
      type: input.type,
      recipient: input.recipient,
      subject: input.subject,
      status: input.status,
      errorMessage: input.errorMessage,
      sentAt: new Date().toISOString(),
    })
    .returning();

  return result[0];
}

/**
 * Creates a new alert_notification junction record
 * @param input - Alert notification creation parameters
 * @returns The created alert notification
 */
export async function createAlertNotification(
  input: CreateAlertNotificationInput,
): Promise<AlertNotification> {
  const result = await db
    .insert(alertNotification)
    .values({
      notificationId: input.notificationId,
      alertId: input.alertId,
      flightDataSnapshot: input.flightDataSnapshot,
      generatedAt: new Date().toISOString(),
    })
    .returning();

  return result[0];
}

/**
 * Gets the most recent alert notification for a specific alert
 * @param alertId - The alert ID
 * @param hoursWindow - Optional time window in hours to check (default: 24)
 * @returns The most recent alert notification or null
 */
export async function getLastNotificationForAlert(
  alertId: string,
  hoursWindow = 24,
): Promise<AlertNotification | null> {
  const cutoffTime = new Date(
    Date.now() - hoursWindow * 60 * 60 * 1000,
  ).toISOString();

  const result = await db
    .select()
    .from(alertNotification)
    .where(
      and(
        eq(alertNotification.alertId, alertId),
        gte(alertNotification.generatedAt, cutoffTime),
      ),
    )
    .orderBy(desc(alertNotification.generatedAt))
    .limit(1);

  return result[0] || null;
}

/**
 * Checks if an alert has been processed recently
 * @param alertId - The alert ID
 * @param hours - Time window in hours (default: 23)
 * @returns True if alert was processed recently, false otherwise
 */
export async function hasAlertBeenProcessedRecently(
  alertId: string,
  hours = 23,
): Promise<boolean> {
  const lastNotification = await getLastNotificationForAlert(alertId, hours);
  return lastNotification !== null;
}

/**
 * Gets all notifications for a specific user
 * @param userId - The user ID
 * @param limit - Optional limit on number of results (default: 100)
 * @returns Array of notifications
 */
export async function getNotificationsByUser(
  userId: string,
  limit = 100,
): Promise<Notification[]> {
  return await db
    .select()
    .from(notification)
    .where(eq(notification.userId, userId))
    .orderBy(desc(notification.sentAt))
    .limit(limit);
}

/**
 * Gets alert notifications for a specific notification ID
 * @param notificationId - The notification ID
 * @returns Array of alert notifications
 */
export async function getAlertNotificationsByNotificationId(
  notificationId: string,
): Promise<AlertNotification[]> {
  return await db
    .select()
    .from(alertNotification)
    .where(eq(alertNotification.notificationId, notificationId));
}

/**
 * Gets alert notifications for a specific alert ID
 * @param alertId - The alert ID
 * @param limit - Optional limit on number of results (default: 10)
 * @returns Array of alert notifications
 */
export async function getAlertNotificationsByAlertId(
  alertId: string,
  limit = 10,
): Promise<AlertNotification[]> {
  return await db
    .select()
    .from(alertNotification)
    .where(eq(alertNotification.alertId, alertId))
    .orderBy(desc(alertNotification.generatedAt))
    .limit(limit);
}

/**
 * Creates a notification and associated alert notifications in a transaction
 * @param notificationInput - Notification creation parameters
 * @param alertIds - Array of alert IDs to associate
 * @param flightDataMap - Optional map of alert ID to flight data
 * @returns The created notification
 */
export async function createNotificationWithAlerts(
  notificationInput: CreateNotificationInput,
  alertIds: string[],
  flightDataMap?: Map<string, FlightOption[]>,
): Promise<Notification> {
  return await db.transaction(async (tx) => {
    // Create notification
    const [newNotification] = await tx
      .insert(notification)
      .values({
        userId: notificationInput.userId,
        type: notificationInput.type,
        recipient: notificationInput.recipient,
        subject: notificationInput.subject,
        status: notificationInput.status,
        errorMessage: notificationInput.errorMessage,
        sentAt: new Date().toISOString(),
      })
      .returning();

    // Create alert notifications
    const alertNotificationValues = alertIds.map((alertId) => ({
      notificationId: newNotification.id,
      alertId,
      flightDataSnapshot: flightDataMap?.get(alertId),
      generatedAt: new Date().toISOString(),
    }));

    if (alertNotificationValues.length > 0) {
      await tx.insert(alertNotification).values(alertNotificationValues);
    }

    return newNotification;
  });
}
