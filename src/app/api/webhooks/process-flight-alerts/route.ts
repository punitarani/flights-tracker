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

export async function POST(request: Request) {
  const signature = request.headers.get(SIGNATURE_HEADER);

  if (!signature || signature !== env.WEBHOOK_SECRET) {
    return new Response(null, { status: 401 });
  }

  try {
    const receiveResult = await db.execute(
      sql`select * from pgmq.receive(${QUEUE_NAME}, ${VISIBILITY_TIMEOUT_SECONDS}, ${BATCH_SIZE});`,
    );

    const rows = (receiveResult.rows ?? []) as QueueRow[];

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

          const lockedRow = lockResult.rows?.[0] as
            | { locked?: boolean | "t" | "f" }
            | undefined;
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

          console.log("Processing alerts for user", userId);

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
