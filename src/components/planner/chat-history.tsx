"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import type { ChatMessage } from "@/server/schemas/planner-message";
import { ChatMessageComponent } from "./chat-message";

interface ChatHistoryProps {
  messages: ChatMessage[];
  isStreaming?: boolean;
  onCardClick?: (componentType: string, data: unknown) => void;
  onSuggestionClick?: (suggestion: string) => void;
  onCopy?: (content: string) => void;
  onRetry?: () => void;
  onToolAction?: (action: string, data: unknown) => void;
}

/**
 * Chat history container
 * Auto-scrolls to bottom, renders messages with streaming support
 */
export function ChatHistory({
  messages,
  isStreaming,
  onCardClick,
  onSuggestionClick,
  onCopy,
  onRetry,
  onToolAction,
}: ChatHistoryProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  // biome-ignore lint/correctness/useExhaustiveDependencies: We want to scroll on every message/streaming change
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md text-center space-y-6">
          <div className="text-6xl">✈️</div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Start Planning Your Trip</h2>
            <p className="text-muted-foreground">
              Ask me anything about flights! I can help you find the best
              options for your next adventure.
            </p>
          </div>
          <div className="mt-6">
            <Suggestions>
              <Suggestion
                onClick={() =>
                  onSuggestionClick?.("Find flights from NYC to LA")
                }
                suggestion="Find flights from NYC to LA"
              />
              <Suggestion
                onClick={() =>
                  onSuggestionClick?.("Best time to fly to Tokyo?")
                }
                suggestion="Best time to fly to Tokyo?"
              />
              <Suggestion
                onClick={() =>
                  onSuggestionClick?.("Cheap flights to Europe next month")
                }
                suggestion="Cheap flights to Europe next month"
              />
              <Suggestion
                onClick={() => onSuggestionClick?.("Compare SFO to PHX prices")}
                suggestion="Compare SFO to PHX prices"
              />
            </Suggestions>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto scroll-smooth px-4 py-6 space-y-6"
    >
      {messages.map((message, idx) => (
        <ChatMessageComponent
          key={message.id}
          message={message}
          onCardClick={onCardClick}
          onCopy={onCopy}
          onRetry={idx === messages.length - 1 ? onRetry : undefined}
          onToolAction={onToolAction}
          isLastMessage={idx === messages.length - 1}
        />
      ))}

      {/* Loading indicator during streaming */}
      {isStreaming && (
        <div className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Thinking</span>
            <span className="flex gap-1">
              <span className="animate-bounce">.</span>
              <span className="animate-bounce [animation-delay:0.2s]">.</span>
              <span className="animate-bounce [animation-delay:0.4s]">.</span>
            </span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
