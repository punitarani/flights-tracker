"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";
import type { FlightPlannerUIMessage } from "@/server/agents/flight-planner-agent";
import type { PageView } from "@/server/schemas/planner-view";
import { usePlannerState } from "./use-planner-state";

/**
 * Flight Planner Chat Hook - Vercel AI SDK Agent Integration
 *
 * Features:
 * - Uses Vercel AI SDK Agent class for multi-step tool calling
 * - Automatic loop management (Agent handles continuation)
 * - Type-safe UIMessages
 * - View synchronization from tool results
 * - Stateful (messages maintained by useChat, not persisted)
 *
 * The Agent class automatically:
 * - Executes tools server-side
 * - Continues loop until stopWhen condition
 * - Handles streaming properly
 * - Provides full type safety
 */
export function usePlannerChat() {
  const { setCurrentView } = usePlannerState();
  const [input, setInput] = useState("");

  const {
    messages,
    sendMessage,
    status,
    error,
    setInput: setInputInternal,
    reload,
  } = useChat<FlightPlannerUIMessage>({
    // API endpoint defaults to /api/chat where our agent responds

    // Called when assistant finishes responding
    onFinish: ({ message }) => {
      console.log("✅ Message finished:", message);
      // Extract view updates from the completed message
      const view = extractViewFromMessage(message);
      if (view) {
        console.log("🗺️ Updating view:", view);
        setCurrentView(view);
      }
    },

    // Error handling
    onError: (error) => {
      console.error("❌ Chat error:", error);
      // Error is automatically added to error state
    },
  });

  // Debug logging to track message state
  console.log("💬 Chat state:", {
    messageCount: messages.length,
    status,
    hasError: !!error,
    lastMessage: messages[messages.length - 1],
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    console.log("📤 Sending message:", input);

    try {
      // Send message using AI SDK's sendMessage (v5 expects object with text property)
      await sendMessage({ text: input });
      setInput("");
      console.log("✅ Message sent successfully");
    } catch (err) {
      console.error("❌ Error sending message:", err);
    }
  };

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    setInput: (value: string) => {
      setInput(value);
      setInputInternal(value);
    },
    reload,
    isLoading: status === "streaming" || status === "submitted",
    error,
  };
}

/**
 * Extract view state from assistant message
 * Analyzes tool invocations to determine what to show in main view
 *
 * UIMessage structure in v5:
 * - parts: Array of message parts (text, tool-call, tool-result, data)
 * - Tool calls and results are in the parts array
 */
function extractViewFromMessage(message: unknown): PageView | null {
  const msg = message as { parts?: unknown[] };

  // Check if message has parts
  if (!msg.parts || msg.parts.length === 0) {
    return null;
  }

  // Collect all tool results from parts
  const toolResults = msg.parts
    .filter((part: unknown) => {
      const p = part as { type?: string; result?: unknown };
      return p.type === "tool-result" && p.result;
    })
    .map((part: unknown) => {
      const p = part as { toolName?: string; result?: unknown };
      return {
        toolName: p.toolName || "unknown",
        result: p.result,
      };
    });

  // Priority 1: If we have flight details, show search view
  const flightDetailsResult = toolResults.find((tr) => {
    const result = tr.result as { flights?: unknown[] };
    return tr.toolName === "searchFlightDetails" && result?.flights;
  });
  if (flightDetailsResult) {
    const result = flightDetailsResult.result as {
      route?: string;
      flights?: unknown[];
    };
    const { route, flights } = result;
    return {
      mode: "search",
      route: parseRouteString(route || ""),
      flightCount: flights?.length || 0,
    } as PageView;
  }

  // Priority 2: If we have route analysis, show map view
  const routeAnalysisResult = toolResults.find((tr) => {
    const result = tr.result as { origin?: unknown };
    return tr.toolName === "analyzeRoute" && result?.origin;
  });
  if (routeAnalysisResult) {
    const result = routeAnalysisResult.result as {
      origin?: Record<string, unknown>;
      destination?: Record<string, unknown>;
      distanceMiles?: number;
    };
    const { origin, destination, distanceMiles } = result;
    if (origin && destination) {
      return {
        mode: "map",
        view: "route",
        data: {
          origin: {
            code: origin.code as string,
            city: origin.city as string,
            country: origin.country as string,
            lat: origin.latitude as number,
            lon: origin.longitude as number,
          },
          destination: {
            code: destination.code as string,
            city: destination.city as string,
            country: destination.country as string,
            lat: destination.latitude as number,
            lon: destination.longitude as number,
          },
          distanceMiles,
        },
      } as PageView;
    }
  }

  // Priority 3: If we have airport search results with multiple airports, show map
  const airportSearchResult = toolResults.find((tr) => {
    const result = tr.result as { airports?: unknown[] };
    return (
      tr.toolName === "searchAirports" && (result?.airports?.length || 0) >= 2
    );
  });
  if (airportSearchResult) {
    const result = airportSearchResult.result as {
      airports?: Record<string, unknown>[];
    };
    const { airports } = result;
    if (airports && airports.length >= 2) {
      const [origin, destination] = airports;

      if (origin && destination) {
        return {
          mode: "map",
          view: "route",
          data: {
            origin: {
              code: origin.code as string,
              city: origin.city as string,
              country: origin.country as string,
              lat: origin.latitude as number,
              lon: origin.longitude as number,
            },
            destination: {
              code: destination.code as string,
              city: destination.city as string,
              country: destination.country as string,
              lat: destination.latitude as number,
              lon: destination.longitude as number,
            },
          },
        } as PageView;
      }
    }
  }

  // Default: no view change
  return null;
}

/**
 * Parse route string like "SFO → LAX" into route object
 */
function parseRouteString(routeStr: string): {
  origin: {
    code: string;
    city: string;
    country: string;
    lat: number;
    lon: number;
  };
  destination: {
    code: string;
    city: string;
    country: string;
    lat: number;
    lon: number;
  };
} {
  const [originCode, destCode] = routeStr.split("→").map((s) => s.trim());

  // Return minimal route object (will be enriched by tool results)
  return {
    origin: {
      code: originCode || "",
      city: originCode || "",
      country: "Unknown",
      lat: 0,
      lon: 0,
    },
    destination: {
      code: destCode || "",
      city: destCode || "",
      country: "Unknown",
      lat: 0,
      lon: 0,
    },
  };
}
