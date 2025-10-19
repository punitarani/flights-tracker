import { validateUIMessages } from "ai";
import { createPlannerAgent, type PlannerContext } from "@/ai";
import { getUserContext } from "@/ai/utils";
import type { ControlSceneOutput } from "@/app/planner/types";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { messages } = await request.json();

  // Get user from Supabase auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Extract user context from request
  const userContext = getUserContext(request, user ?? undefined);

  // Extract current scene from messages (find last controlScene tool output)
  let currentScene: PlannerContext["scene"] = {
    view: "map",
    mode: "popular",
    data: null,
  };

  // Find the last controlScene tool call with output
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message?.role === "assistant" && message?.parts) {
      const scenePart = message.parts.find(
        // biome-ignore lint/suspicious/noExplicitAny: Message parts have dynamic tool types
        (p: any) =>
          p.type === "tool-controlScene" && p.state === "output-available",
      );
      if (scenePart?.output?.scene) {
        const output = scenePart.output as ControlSceneOutput;
        if (output.scene) {
          currentScene = output.scene;
          break;
        }
      }
    }
  }

  // Build context with user info and current scene
  const context: PlannerContext = {
    user: userContext,
    scene: currentScene,
  };

  // Create agent with personalized system prompt
  const agent = createPlannerAgent(context);

  // Validate and respond
  return agent.respond({
    messages: await validateUIMessages({ messages }),
  });
}
