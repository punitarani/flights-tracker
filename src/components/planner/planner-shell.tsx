"use client";

import { useState } from "react";
import { toast } from "sonner";
import { usePlannerChat } from "@/hooks/use-planner-chat";
import { usePlannerState } from "@/hooks/use-planner-state";
import { api } from "@/lib/trpc/react";
import { ChatHistory } from "./chat-history";
import { ChatInput } from "./chat-input";
import { DetailSheet } from "./detail-sheet";
import { ViewManager } from "./view-manager";

/**
 * Main planner shell
 * Multi-step agentic chat interface with Vercel AI SDK
 *
 * Architecture:
 * - State: Zustand (global) + useChat (Vercel AI SDK)
 * - Streaming: Native Vercel AI SDK streaming
 * - LLM: 100% AI-driven with tool calling (no hard-coded logic)
 * - Views: Dynamic based on tool results
 * - Persistence: NONE - stateful only (messages live in memory)
 *
 * Layout:
 * - Desktop: Chat (left 40%) | Main View (right 60%)
 * - Mobile: Stacked layout
 */
export function PlannerShell() {
  const { currentView, setCurrentView } = usePlannerState();

  // Vercel AI SDK useChat hook - handles all chat state and streaming
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setInput,
    reload,
  } = usePlannerChat();

  const [detailSheet, setDetailSheet] = useState<{
    open: boolean;
    title: string;
    content: unknown | null;
  }>({
    open: false,
    title: "",
    content: null,
  });

  // Action handlers
  const handleCardClick = (type: string, data: unknown) => {
    setDetailSheet({ open: true, title: type, content: data });
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard");
  };

  const handleRetry = () => {
    reload();
    toast.info("Regenerating response...");
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    // Auto-submit after a brief delay to show the suggestion in the input
    setTimeout(() => {
      const form = document.querySelector("form");
      if (form) {
        form.requestSubmit();
      }
    }, 100);
  };

  const handleToolAction = (action: string, data: unknown) => {
    const actionData = data as Record<string, unknown>;
    console.log("Tool action:", action, data);

    switch (action) {
      case "viewOnMap":
        // Update view to show map with this route
        if (actionData.origin && actionData.destination) {
          const origin = actionData.origin as Record<string, unknown>;
          const destination = actionData.destination as Record<string, unknown>;
          setCurrentView({
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
              distanceMiles: actionData.distanceMiles as number,
            },
          });
          toast.success("Showing route on map");
        }
        break;

      case "searchDate":
        // Auto-populate input with date-specific search
        if (actionData.origin && actionData.destination && actionData.date) {
          const query = `Find flights from ${actionData.origin} to ${actionData.destination} on ${actionData.date}`;
          setInput(query);
          toast.info("Search query ready - press enter to search");
        }
        break;

      case "viewFlightDetails":
        // Open detail sheet with flight info
        setDetailSheet({
          open: true,
          title: "Flight Details",
          content: actionData,
        });
        break;

      case "retry":
        handleRetry();
        break;

      default:
        console.log("Unknown action:", action);
    }
  };

  // Load airports for map
  const airportSearchQuery = api.useQuery(
    ["airports.search", { limit: 10000 }],
    {
      retry: (failureCount, error) => {
        if (
          error?.message?.includes("AbortError") ||
          error?.message?.includes("aborted")
        ) {
          return false;
        }
        return failureCount < 3;
      },
    },
  );

  const airports = airportSearchQuery.data?.airports ?? [];

  // Convert Vercel AI SDK UIMessage to our ChatMessage format for display
  const chatMessages = (messages as unknown[]).map(
    (msg: unknown, index: number) => {
      const message = msg as {
        id?: string;
        role?: string;
        parts?: unknown[];
        content?: string;
      };

      // Debug: Log raw message structure
      if (index === messages.length - 1) {
        console.log("🔍 Latest message structure:", {
          id: message.id,
          role: message.role,
          hasParts: !!message.parts,
          hasContent: !!message.content,
          partsCount: message.parts?.length || 0,
          keys: Object.keys(message),
        });
      }

      // UIMessage v5 has parts array - extract text content
      const messageParts = message.parts || [];

      // Extract text content from parts, or fallback to direct content property
      let content = "";
      if (messageParts.length > 0) {
        content = messageParts
          .filter((part: unknown) => {
            const p = part as { type?: string };
            return p.type === "text";
          })
          .map((part: unknown) => {
            const p = part as { text?: string };
            return p.text || "";
          })
          .join("");
      } else if (typeof message.content === "string") {
        // Fallback: direct content property (for user messages or older format)
        content = message.content;
      }

      return {
        id: message.id || "",
        role: message.role as "user" | "assistant" | "system",
        content,
        timestamp: new Date().toISOString(),
        isStreaming: false,
        toolInvocations: messageParts.filter((part: unknown) => {
          const p = part as { type?: string };
          return p.type === "tool-call" || p.type === "tool-result";
        }),
      };
    },
  );

  // Debug: Log final chat messages
  console.log("💬 Rendered messages:", chatMessages.length);

  return (
    <div className="flex h-[calc(100vh-120px)] w-full flex-col md:flex-row">
      {/* Chat Panel - Left side on desktop */}
      <div className="flex h-full w-full flex-col border-r bg-background md:w-2/5">
        {/* Chat Header */}
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">AI Flight Assistant</h2>
          <p className="text-xs text-muted-foreground">
            Multi-step agentic search powered by AI
          </p>
        </div>

        {/* Chat Messages */}
        <ChatHistory
          messages={chatMessages}
          isStreaming={isLoading}
          onCardClick={handleCardClick}
          onSuggestionClick={handleSuggestionClick}
          onCopy={handleCopy}
          onRetry={handleRetry}
          onToolAction={handleToolAction}
        />

        {/* Chat Input */}
        <ChatInput
          input={input}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          disabled={isLoading}
          status={isLoading ? "streaming" : "ready"}
        />
      </div>

      {/* Main View - Right side on desktop */}
      <div className="relative flex-1 overflow-hidden bg-muted/10">
        <ViewManager currentView={currentView} airports={airports} />
      </div>

      {/* Detail Sheet */}
      <DetailSheet
        open={detailSheet.open}
        onClose={() => setDetailSheet({ ...detailSheet, open: false })}
        title={detailSheet.title}
      >
        <pre className="text-xs overflow-auto">
          {JSON.stringify(detailSheet.content, null, 2)}
        </pre>
      </DetailSheet>
    </div>
  );
}
