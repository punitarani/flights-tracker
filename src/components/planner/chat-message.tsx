"use client";

import { Bot, CopyIcon, RefreshCcwIcon, User } from "lucide-react";
import { Action, Actions } from "@/components/ai-elements/actions";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import { Tool } from "@/components/ai-elements/tool";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ChatMessage } from "@/server/schemas/planner-message";
import type { ChatUIComponent } from "@/server/schemas/planner-view";
import { ToolResultRenderer } from "./tool-result-renderer";
import { ComparisonTable } from "./ui/comparison-table";
import { FlightCard } from "./ui/flight-card";
import { PriceChart } from "./ui/price-chart";
import { RouteSummary } from "./ui/route-summary";

interface ChatMessageProps {
  message: ChatMessage & {
    toolInvocations?: Array<{
      state: "call" | "result" | "partial-call";
      toolName: string;
      toolCallId: string;
      args?: unknown;
      result?: unknown;
    }>;
  };
  onCardClick?: (componentType: string, data: unknown) => void;
  onCopy?: (content: string) => void;
  onRetry?: () => void;
  onToolAction?: (action: string, data: unknown) => void;
  isLastMessage?: boolean;
}

/**
 * Individual chat message component
 * Renders user/assistant messages with AI Elements integration
 */
export function ChatMessageComponent({
  message,
  onCardClick,
  onCopy,
  onRetry,
  onToolAction,
  isLastMessage = false,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  if (!isUser && !isAssistant) return null;

  const handleCopy = () => {
    onCopy?.(message.content);
    navigator.clipboard.writeText(message.content);
  };

  return (
    <div
      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"} group`}
    >
      {isAssistant && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </AvatarFallback>
        </Avatar>
      )}

      <div
        className={`flex max-w-[85%] flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}
      >
        {/* Text content using AI Elements */}
        {isUser ? (
          <div className="rounded-2xl px-4 py-2.5 bg-primary text-primary-foreground">
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          </div>
        ) : (
          <Message from="assistant">
            <MessageContent>
              <Response>{message.content}</Response>
              {/* Streaming indicator */}
              {message.isStreaming && (
                <span className="inline-flex h-4 w-1 animate-pulse bg-foreground/40 ml-1" />
              )}
            </MessageContent>
          </Message>
        )}

        {/* Tool Invocations - Show loading and results */}
        {isAssistant &&
          message.toolInvocations &&
          message.toolInvocations.length > 0 && (
            <div className="flex w-full flex-col gap-3 mt-2">
              {message.toolInvocations.map((tool: unknown, idx: number) => {
                const toolPart = tool as {
                  type?: string;
                  toolName?: string;
                  args?: unknown;
                  result?: unknown;
                };
                // Show loading state for tool calls
                if (toolPart.type === "tool-call") {
                  return (
                    <Tool
                      key={`${message.id}-tool-call-${idx}`}
                      toolName={toolPart.toolName || "unknown"}
                      args={toolPart.args}
                      state="loading"
                    />
                  );
                }

                // Show results with custom components
                if (toolPart.type === "tool-result" && toolPart.result) {
                  return (
                    <ToolResultRenderer
                      key={`${message.id}-tool-result-${idx}`}
                      toolName={toolPart.toolName || "unknown"}
                      result={toolPart.result}
                      args={toolPart.args}
                      state="result"
                      onAction={onToolAction}
                    />
                  );
                }

                return null;
              })}
            </div>
          )}

        {/* UI Components (legacy support) */}
        {isAssistant &&
          message.uiComponents &&
          message.uiComponents.length > 0 && (
            <div className="flex w-full flex-col gap-2">
              {message.uiComponents.map((component, idx) => (
                <UIComponentRenderer
                  key={`${message.id}-ui-${idx}`}
                  component={component}
                  onCardClick={onCardClick}
                />
              ))}
            </div>
          )}

        {/* Action buttons for assistant messages */}
        {isAssistant && isLastMessage && message.content && (
          <Actions className="mt-1">
            <Action onClick={handleCopy} label="Copy">
              <CopyIcon className="size-3" />
            </Action>
            {onRetry && (
              <Action onClick={onRetry} label="Retry">
                <RefreshCcwIcon className="size-3" />
              </Action>
            )}
          </Actions>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-muted-foreground px-2">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {isUser && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-muted">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

/**
 * Renders UI components based on type
 */
function UIComponentRenderer({
  component,
  onCardClick,
}: {
  component: ChatUIComponent;
  onCardClick?: (componentType: string, data: unknown) => void;
}) {
  switch (component.type) {
    case "flightCards":
      return (
        <div className="flex flex-col gap-2">
          {component.data.map((flight) => (
            <FlightCard
              key={flight.id}
              flight={flight}
              onClick={() => onCardClick?.("flight", flight)}
            />
          ))}
        </div>
      );

    case "priceChart":
      return (
        <PriceChart
          data={component.data}
          onClick={() => onCardClick?.("priceChart", component.data)}
        />
      );

    case "comparisonTable":
      return (
        <ComparisonTable
          data={component.data}
          onClick={(routeData) => onCardClick?.("route", routeData)}
        />
      );

    case "routeSummary":
      return (
        <RouteSummary
          data={component.data}
          onClick={() => onCardClick?.("routeSummary", component.data)}
        />
      );

    default:
      return null;
  }
}
