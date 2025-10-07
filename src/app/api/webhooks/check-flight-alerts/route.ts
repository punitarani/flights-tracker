import { getUserIdsWithActiveDailyAlerts } from "@/core/alerts-db";
import { env } from "@/env";
import { createServiceClient } from "@/lib/supabase/service";

const SIGNATURE_HEADER = "x-signature";
const QUEUE_NAME = "check_alerts";

export async function POST(request: Request) {
  const signature = request.headers.get(SIGNATURE_HEADER);

  if (!signature || signature !== env.WEBHOOK_SECRET) {
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
        console.error("Failed to enqueue user", userId, error);
      }
    }

    return Response.json({ totalUsers: userIds.length, enqueued });
  } catch (error) {
    console.error("Failed to enqueue daily alerts", error);
    return new Response(null, { status: 500 });
  }
}
