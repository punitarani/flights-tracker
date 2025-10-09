import { processDailyAlertsForUser } from "@/core/alert-processing-service";
import { acquireUserLock } from "@/core/alerts-db";
import { env } from "@/env";
import { createServiceClient } from "@/lib/supabase/service";

const SIGNATURE_HEADER = "x-signature";
const QUEUE_NAME = "check_alerts";
const VISIBILITY_TIMEOUT_SECONDS = 30;
const BATCH_SIZE = 10;

type QueueRow = {
  msg_id: number;
  message: { userId?: string } | null;
};

export async function POST(request: Request) {
  const signature = request.headers.get(SIGNATURE_HEADER);

  if (!signature || signature !== env.WEBHOOK_SECRET) {
    return new Response(null, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const processed: string[] = [];
    const skipped: string[] = [];

    for (let i = 0; i < BATCH_SIZE; i += 1) {
      const { data, error: popError } = await supabase
        .schema("pgmq_public")
        .rpc("pop", {
          queue_name: QUEUE_NAME,
        });

      if (popError) {
        throw popError;
      }

      const row = Array.isArray(data)
        ? ((data as QueueRow[])[0] ?? null)
        : ((data as QueueRow | null | undefined) ?? null);

      if (!row) {
        break;
      }

      const message = row.message ?? {};
      const userId = typeof message.userId === "string" ? message.userId : null;

      if (!userId) {
        console.error("Invalid queue payload", message);
        continue;
      }

      try {
        const locked = await acquireUserLock(userId);

        if (!locked) {
          skipped.push(userId);
          const { error: requeueError } = await supabase
            .schema("pgmq_public")
            .rpc("send", {
              queue_name: QUEUE_NAME,
              message: { userId },
            });

          if (requeueError) {
            console.error(
              "Failed to requeue user after lock contention",
              userId,
              requeueError,
            );
          }

          continue;
        }

        console.log("Processing alerts for user", userId);

        // Process daily alerts for this user
        const success = await processDailyAlertsForUser(userId);

        if (success) {
          processed.push(userId);
        } else {
          throw new Error("Alert processing failed");
        }
      } catch (error) {
        console.error("Failed processing user", userId, error);
        const { error: requeueError } = await supabase
          .schema("pgmq_public")
          .rpc("send", {
            queue_name: QUEUE_NAME,
            message: { userId },
            sleep_seconds: VISIBILITY_TIMEOUT_SECONDS,
          });

        if (requeueError) {
          console.error(
            "Failed to requeue user after processing error",
            userId,
            requeueError,
          );
        }
      }
    }

    return Response.json({ processed, skipped });
  } catch (error) {
    console.error("Failed to process flight alerts", error);
    return new Response(null, { status: 500 });
  }
}
