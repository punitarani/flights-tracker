import { sql } from "drizzle-orm";
import { getUserIdsWithActiveDailyAlerts } from "@/core/alerts-db";
import { db } from "@/db/client";
import { env } from "@/env";

const SIGNATURE_HEADER = "x-signature";
const QUEUE_NAME = "check_alerts";

export async function POST(request: Request) {
  const signature = request.headers.get(SIGNATURE_HEADER);

  if (!signature || signature !== env.WEBHOOK_SECRET) {
    return new Response(null, { status: 401 });
  }

  try {
    const userIds = await getUserIdsWithActiveDailyAlerts();

    let enqueued = 0;

    for (const userId of userIds) {
      try {
        await db.execute(
          sql`select pgmq.send(${QUEUE_NAME}, jsonb_build_object('userId', ${userId}));`,
        );
        enqueued += 1;
      } catch (error) {
        console.error("Failed to enqueue user", userId, error);
      }
    }

    return Response.json({ totalUsers: userIds.length, enqueued });
  } catch (error) {
    console.error("Failed to enqueue daily alerts", error);
    return new Response(null, { status: 500 });
  }
}
