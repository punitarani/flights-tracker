import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { env } from "@/env";

const SIGNATURE_HEADER = "x-signature";
const QUEUE_NAME = "check_alerts";
const VISIBILITY_TIMEOUT_SECONDS = 30;
const BATCH_SIZE = 10;

type QueueRow = {
  msg_id: number;
  msg: { userId?: string } | null;
};

type TransactionLike = {
  execute: (
    query: unknown,
  ) =>
    | Promise<{ rows?: Record<string, unknown>[] | undefined } | undefined>
    | { rows?: Record<string, unknown>[] | undefined }
    | undefined;
};

type AlertRecord = {
  id: string;
  type: string;
  filters: unknown;
  alertEnd: string | null;
  createdAt: string;
};

type FlightDetails = {
  reference: string;
  note: string;
  filters: unknown;
};

type AlertNotificationSummary = {
  alert: AlertRecord;
  flights: FlightDetails[];
};

export async function POST(request: Request) {
  const signature = request.headers.get(SIGNATURE_HEADER);

  if (!signature || signature !== env.WEBHOOK_SECRET) {
    return new Response(null, { status: 401 });
  }

  try {
    const receiveResult = await db.execute(
      sql`select * from pgmq.receive(${QUEUE_NAME}, ${VISIBILITY_TIMEOUT_SECONDS}, ${BATCH_SIZE});`,
    );

    const rows = (extractRows(receiveResult) ?? []) as QueueRow[];

    if (rows.length === 0) {
      return Response.json({ processed: [], skipped: [] });
    }

    const processed: string[] = [];
    const skipped: string[] = [];

    for (const row of rows) {
      const message = row.msg ?? {};
      const userId = typeof message.userId === "string" ? message.userId : null;

      if (!userId) {
        console.error("Invalid queue payload", message);
        await db.execute(
          sql`select pgmq.delete(${QUEUE_NAME}, ${row.msg_id});`,
        );
        continue;
      }

      try {
        await db.transaction(async (tx) => {
          const lockResult = await tx.execute(
            sql`select pg_try_advisory_xact_lock(hashtext(${userId})) as locked;`,
          );

          const lockRows = extractRows(lockResult) as
            | Array<{ locked?: boolean | "t" | "f" } | undefined>
            | undefined;
          const lockedRow = lockRows?.[0];
          const lockedValue = lockedRow?.locked;
          const locked =
            typeof lockedValue === "boolean"
              ? lockedValue
              : lockedValue === "t";

          if (!locked) {
            skipped.push(userId);
            await tx.execute(
              sql`select pgmq.set_vt(${QUEUE_NAME}, ${row.msg_id}, 0);`,
            );
            return;
          }

          const alerts = await fetchActiveAlertsForUser(tx, userId);
          const email = await fetchUserEmail(userId);
          const summaries = buildAlertSummaries(alerts);

          sendUserNotification({ userId, email, summaries });

          await tx.execute(
            sql`select pgmq.delete(${QUEUE_NAME}, ${row.msg_id});`,
          );
          processed.push(userId);
        });
      } catch (error) {
        console.error("Failed processing user", userId, error);
        await db.execute(
          sql`select pgmq.set_vt(${QUEUE_NAME}, ${row.msg_id}, ${VISIBILITY_TIMEOUT_SECONDS});`,
        );
      }
    }

    return Response.json({ processed, skipped });
  } catch (error) {
    console.error("Failed to process flight alerts", error);
    return new Response(null, { status: 500 });
  }
}

async function fetchActiveAlertsForUser(
  tx: TransactionLike,
  userId: string,
): Promise<AlertRecord[]> {
  const result = await tx.execute(
    sql`select id, type, filters, alert_end, created_at from alert where user_id = ${userId} and status = 'active';`,
  );

  const rows = extractRows(result);

  return (rows ?? []).map((row) => ({
    id: String(row?.id ?? ""),
    type: String(row?.type ?? ""),
    filters: row?.filters ?? null,
    alertEnd:
      row?.alert_end === null || row?.alert_end === undefined
        ? null
        : String(row?.alert_end),
    createdAt: String(row?.created_at ?? ""),
  }));
}

function buildAlertSummaries(alerts: AlertRecord[]): AlertNotificationSummary[] {
  return alerts.map((alert) => ({
    alert,
    flights: generateMockFlights(alert),
  }));
}

function generateMockFlights(alert: AlertRecord): FlightDetails[] {
  return [
    {
      reference: `mock-flight-${alert.id}`,
      note: "Replace with real flight search results",
      filters: alert.filters,
    },
  ];
}

async function fetchUserEmail(_userId: string): Promise<string | null> {
  return null;
}

function sendUserNotification(input: {
  userId: string;
  email: string | null;
  summaries: AlertNotificationSummary[];
}) {
  const { userId, email, summaries } = input;

  console.log("===== Flight Alert Notification =====");
  console.log(`User ID: ${userId}`);
  console.log(`Email: ${email ?? "unknown"}`);

  if (summaries.length === 0) {
    console.log("No active alerts found for this user.");
  } else {
    summaries.forEach((summary, index) => {
      console.log(
        `Alert ${index + 1} (${summary.alert.id}) - ${summary.alert.type}`,
      );
      console.log("  Filters:");
      console.log(indentBlock(JSON.stringify(summary.alert.filters, null, 2)));
      console.log("  Flight data:");

      if (summary.flights.length === 0) {
        console.log("    (no mock flight data available)");
        return;
      }

      summary.flights.forEach((flight, flightIndex) => {
        console.log(`    Flight ${flightIndex + 1}:`);
        console.log(indentBlock(JSON.stringify(flight, null, 2), 6));
      });
    });
  }

  console.log("====================================");
}

function indentBlock(text: string, spaces = 4) {
  const padding = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => `${padding}${line}`)
    .join("\n");
}

function extractRows(
  result:
    | { rows?: Record<string, unknown>[] | undefined }
    | Record<string, unknown>[]
    | undefined
    | null,
) {
  if (!result) return undefined;
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  return result.rows;
}
