"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Eye, Map as MapIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { PlannerAgentUIMessage } from "@/ai";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Loader } from "@/components/ai-elements/loader";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Response } from "@/components/ai-elements/response";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { api } from "@/lib/trpc/react";
import { SceneView } from "./components/scene-view";
import { SuggestionsCarousel } from "./components/suggestions-carousel";
import { ToolRenderer } from "./components/tool-renderer";
import type { ControlSceneOutput, PlannerScene } from "./types";

export default function PlannerPage() {
  const [input, setInput] = useState("");
  const [isScenePanelOpen, setIsScenePanelOpen] = useState(false);
  const [scene, setScene] = useState<PlannerScene>({
    view: "map" as const,
    mode: "popular" as const,
    data: null,
  });

  // Load airports for search scene
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
      onError: (error) => {
        if (
          error?.message?.includes("AbortError") ||
          error?.message?.includes("aborted")
        ) {
          return;
        }
        console.error("Airport search error:", error);
      },
    },
  );

  const airports = airportSearchQuery.data?.airports ?? [];

  const { messages, sendMessage, status, error } =
    useChat<PlannerAgentUIMessage>({
      transport: new DefaultChatTransport({
        api: "/api/planner",
      }),
      onError: (error) => {
        console.error("Chat error:", error);
      },
    });

  // Update scene when controlScene tool is called
  useEffect(() => {
    const lastMessage = messages.at(-1);
    if (lastMessage?.role === "assistant") {
      const sceneTool = lastMessage.parts.find(
        (p) => p.type === "tool-controlScene" && p.state === "output-available",
      );
      if (sceneTool) {
        const output = sceneTool.output as ControlSceneOutput;
        if (output?.scene) {
          setScene(output.scene);
        }
      }
    }
  }, [messages]);

  const handleSubmit = (message: { text?: string }) => {
    if (!message.text?.trim()) return;

    sendMessage({
      role: "user",
      parts: [{ type: "text", text: message.text }],
    });
    setInput("");
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage({
      role: "user",
      parts: [{ type: "text", text: suggestion }],
    });
  };

  const sceneTitle =
    scene.view === "map"
      ? scene.mode === "popular"
        ? "Popular Routes"
        : "Airport Routes"
      : "Search Filters";

  // Check if last assistant message has renderable content
  const lastMessage = messages.at(-1);
  const hasVisibleContent =
    lastMessage?.role === "assistant" &&
    lastMessage.parts.some((part) => {
      // Text parts with content
      if (part.type === "text" && part.text?.trim()) return true;
      // Tool parts in any state
      if (part.type.startsWith("tool-") && "state" in part) {
        return true;
      }
      return false;
    });

  return (
    <div className="fixed inset-0 flex flex-col bg-background z-50">
      {/* Header */}
      <Header />

      {/* Main Content - Horizontal 50/50 Split for Both Scenes */}
      <div className="flex flex-1 min-h-0">
        {/* Left Panel - Chat/Welcome Area */}
        <div className="w-full lg:w-1/2 flex flex-col h-full border-r">
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Conversation/Welcome Area */}
            <div className="flex-1 overflow-y-auto">
              {scene.view === "map" ? (
                // Map Scene: Show welcome message only (no conversation history)
                <div className="h-full">
                  {messages.length === 0 && (
                    <div className="flex items-center justify-center min-h-[400px]">
                      <div className="text-center space-y-4 p-8">
                        <div className="text-6xl">✈️</div>
                        <h2 className="text-2xl font-bold">
                          Where do you want to go?
                        </h2>
                        <p className="text-muted-foreground">
                          Ask me to find flights, compare dates, or explore
                          popular routes.
                        </p>
                      </div>
                    </div>
                  )}
                  {/* Show conversation on mobile for map scene */}
                  {messages.length > 0 && (
                    <Conversation className="h-full lg:hidden">
                      <ConversationContent className="flex flex-col space-y-2">
                        {messages.map((message) => (
                          <Message key={message.id} from={message.role}>
                            {message.parts.map((part, i) => {
                              if (part.type === "text") {
                                if (!part.text?.trim()) return null;
                                return (
                                  <MessageContent
                                    key={`${message.id}-text-${i}`}
                                    variant={
                                      message.role === "assistant"
                                        ? "flat"
                                        : "contained"
                                    }
                                  >
                                    <Response>{part.text}</Response>
                                  </MessageContent>
                                );
                              }
                              return (
                                <ToolRenderer
                                  key={`${message.id}-tool-${i}`}
                                  part={part}
                                />
                              );
                            })}
                          </Message>
                        ))}
                        {status === "submitted" && (
                          <Message from="assistant">
                            <MessageContent variant="flat">
                              <div className="flex items-center gap-2">
                                <Loader />
                                <span className="text-sm text-muted-foreground">
                                  Thinking...
                                </span>
                              </div>
                            </MessageContent>
                          </Message>
                        )}
                        {status === "streaming" && !hasVisibleContent && (
                          <Message from="assistant">
                            <MessageContent variant="flat">
                              <Shimmer className="text-sm">
                                Finding flights...
                              </Shimmer>
                            </MessageContent>
                          </Message>
                        )}
                        {error && (
                          <Message from="assistant">
                            <MessageContent>
                              <div className="space-y-2">
                                <p className="text-sm text-destructive font-medium">
                                  Sorry, something went wrong processing your
                                  request.
                                </p>
                                <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md font-mono">
                                  {error.message}
                                </div>
                              </div>
                            </MessageContent>
                          </Message>
                        )}
                      </ConversationContent>
                      <ConversationScrollButton />
                    </Conversation>
                  )}
                </div>
              ) : (
                // Search Scene: Show full conversation history
                <Conversation className="h-full">
                  <ConversationContent className="flex flex-col space-y-2">
                    {messages.length === 0 && (
                      <div className="flex items-center justify-center min-h-[400px]">
                        <div className="text-center space-y-4 p-8">
                          <div className="text-6xl">✈️</div>
                          <h2 className="text-2xl font-bold">
                            Where do you want to go?
                          </h2>
                          <p className="text-muted-foreground">
                            Ask me to find flights, compare dates, or explore
                            popular routes.
                          </p>
                        </div>
                      </div>
                    )}

                    {messages.map((message) => (
                      <Message key={message.id} from={message.role}>
                        {message.parts.map((part, i) => {
                          if (part.type === "text") {
                            if (!part.text?.trim()) return null;
                            return (
                              <MessageContent
                                key={`${message.id}-text-${i}`}
                                variant={
                                  message.role === "assistant"
                                    ? "flat"
                                    : "contained"
                                }
                              >
                                <Response>{part.text}</Response>
                              </MessageContent>
                            );
                          }
                          return (
                            <ToolRenderer
                              key={`${message.id}-tool-${i}`}
                              part={part}
                            />
                          );
                        })}
                      </Message>
                    ))}

                    {status === "submitted" && (
                      <Message from="assistant">
                        <MessageContent variant="flat">
                          <div className="flex items-center gap-2">
                            <Loader />
                            <span className="text-sm text-muted-foreground">
                              Thinking...
                            </span>
                          </div>
                        </MessageContent>
                      </Message>
                    )}
                    {status === "streaming" && !hasVisibleContent && (
                      <Message from="assistant">
                        <MessageContent variant="flat">
                          <Shimmer className="text-sm">
                            Finding flights...
                          </Shimmer>
                        </MessageContent>
                      </Message>
                    )}

                    {error && (
                      <Message from="assistant">
                        <MessageContent>
                          <div className="space-y-2">
                            <p className="text-sm text-destructive font-medium">
                              Sorry, something went wrong processing your
                              request.
                            </p>
                            <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md font-mono">
                              {error.message}
                            </div>
                          </div>
                        </MessageContent>
                      </Message>
                    )}
                  </ConversationContent>
                  <ConversationScrollButton />
                </Conversation>
              )}
            </div>

            {/* Input Area - Sticky at Bottom */}
            <div className="border-t p-4 flex-shrink-0 space-y-4">
              {messages.length === 0 && (
                <SuggestionsCarousel
                  onSuggestionSelect={handleSuggestionClick}
                />
              )}
              <PromptInput onSubmit={handleSubmit} className="w-full">
                <PromptInputBody>
                  <PromptInputTextarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about flights, dates, or destinations..."
                    className="min-h-[60px]"
                  />
                </PromptInputBody>
                <PromptInputFooter>
                  <PromptInputTools>
                    <Button
                      onClick={() => setIsScenePanelOpen(true)}
                      variant="ghost"
                      size="sm"
                      className="gap-2 lg:hidden"
                      title={`View ${sceneTitle}`}
                    >
                      {scene.view === "map" ? (
                        <MapIcon className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                      <span className="text-xs">{sceneTitle}</span>
                    </Button>
                  </PromptInputTools>
                  <PromptInputSubmit disabled={!input.trim()} status={status} />
                </PromptInputFooter>
              </PromptInput>
            </div>
          </div>
        </div>

        {/* Right Panel - Scene View (Map or Search) */}
        <div className="hidden lg:flex lg:w-1/2 flex-col h-full border-l">
          <div className="flex-1 overflow-y-auto">
            <SceneView
              scene={scene}
              airports={airports}
              isLoadingAirports={airportSearchQuery.isLoading}
            />
          </div>
        </div>
      </div>

      {/* Scene Panel - Mobile Sheet (unchanged) */}
      <Sheet open={isScenePanelOpen} onOpenChange={setIsScenePanelOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0">
          <div className="flex flex-col h-full">
            <SheetHeader className="border-b p-4 flex-shrink-0">
              <SheetTitle>{sceneTitle}</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto">
              <SceneView
                scene={scene}
                airports={airports}
                isLoadingAirports={airportSearchQuery.isLoading}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
