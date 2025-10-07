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
    const { data: rows, error: readError } = await supabase
      .schema("pgmq_public")
      .rpc("read", {
        queue_name: QUEUE_NAME,
        sleep_seconds: VISIBILITY_TIMEOUT_SECONDS,
        n: BATCH_SIZE,
      });

    if (readError) {
      throw readError;
    }

    const messages = Array.isArray(rows) ? (rows as QueueRow[]) : [];

    if (messages.length === 0) {
      return Response.json({ processed: [], skipped: [] });
    }

    const processed: string[] = [];
    const skipped: string[] = [];

    for (const row of messages) {
      const message = row.message ?? {};
      const userId = typeof message.userId === "string" ? message.userId : null;

      if (!userId) {
        console.error("Invalid queue payload", message);
        await supabase.schema("pgmq_public").rpc("delete", {
          queue_name: QUEUE_NAME,
          msg_id: row.msg_id,
        });
        continue;
      }

      try {
        const locked = await acquireUserLock(userId);

        if (!locked) {
          skipped.push(userId);
          await supabase.schema("pgmq_public").rpc("set_vt", {
            queue_name: QUEUE_NAME,
            msg_id: row.msg_id,
            vt: 0,
          });
          continue;
        }

        console.log("Processing alerts for user", userId);

        await supabase.schema("pgmq_public").rpc("delete", {
          queue_name: QUEUE_NAME,
          msg_id: row.msg_id,
        });
        processed.push(userId);
      } catch (error) {
        console.error("Failed processing user", userId, error);
        await supabase.schema("pgmq_public").rpc("set_vt", {
          queue_name: QUEUE_NAME,
          msg_id: row.msg_id,
          vt: VISIBILITY_TIMEOUT_SECONDS,
        });
      }
    }

    return Response.json({ processed, skipped });
  } catch (error) {
    console.error("Failed to process flight alerts", error);
    return new Response(null, { status: 500 });
  }
}
