import { env } from "@/env";

const SIGNATURE_HEADER = "x-signature";

export async function POST(request: Request) {
  const signature = request.headers.get(SIGNATURE_HEADER);

  if (!signature || signature !== env.WEBHOOK_SECRET) {
    return new Response(null, { status: 401 });
  }

  return Response.json(true);
}
