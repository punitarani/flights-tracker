import { logger } from "@/lib/logger";
import { flightPlannerAgent } from "@/server/agents/flight-planner-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * AI Flight Planner Chat API - Agent Class
 *
 * Uses Vercel AI SDK Agent class for automatic multi-step tool calling.
 * The agent autonomously uses tools to search flights.
 */
export async function POST(request: Request) {
  console.log("🚀 Chat API - Flight Planner Agent");

  try {
    const { messages } = await request.json();

    console.log("📥 Received", messages.length, "messages");

    logger.info("📥 Chat request", {
      messageCount: messages.length,
    });

    // Use agent.respond() - handles multi-step loop automatically
    console.log("🤖 Calling agent.respond()...");
    const response = flightPlannerAgent.respond({
      messages,
    });

    console.log("✅ Agent response created");
    logger.info("✅ Agent response streaming");

    return response;
  } catch (error) {
    console.error("💥 Error:", error);
    logger.error("Chat API error", { error });

    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
