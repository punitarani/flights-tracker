import { getUserIdsWithActiveDailyAlerts } from "@/core/alerts-db";
import { logger } from "@/lib/logger";
import { createServiceClient } from "@/lib/supabase/service";
import { isAuthenticated } from "../auth";

const QUEUE_NAME = "check_alerts";

export async function POST(request: Request) {
  if (!isAuthenticated(request)) {
    return new Response(null, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const userIds = await getUserIdsWithActiveDailyAlerts();

    let enqueued = 0;

    for (const userId of userIds) {
      try {
        const { error } = await supabase.schema("pgmq_public").rpc("send", {
          queue_name: QUEUE_NAME,
          message: { userId },
        });

        if (error) {
          throw error;
        }

        enqueued += 1;
      } catch (error) {
        logger.error("Failed to enqueue user for daily alerts", {
          userId,
          error,
        });
      }
    }

    return Response.json({ totalUsers: userIds.length, enqueued });
  } catch (error) {
    logger.error("Failed to enqueue daily alerts", { error });
    return new Response(null, { status: 500 });
  }
}
