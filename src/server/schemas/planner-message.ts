import { z } from "zod";
import { ChatUIComponentSchema, PageViewSchema } from "./planner-view";

/**
 * Chat message role
 */
export const MessageRoleSchema = z.enum(["user", "assistant", "system"]);

export type MessageRole = z.infer<typeof MessageRoleSchema>;

/**
 * Chat message schema
 */
export const ChatMessageSchema = z.object({
  id: z.string(),
  role: MessageRoleSchema,
  content: z.string(),
  uiComponents: z.array(ChatUIComponentSchema).optional(),
  pageView: PageViewSchema.optional(),
  timestamp: z.string(),
  isStreaming: z.boolean().optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

/**
 * Streaming chunk types
 */
export const StreamChunkSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    content: z.string(),
  }),
  z.object({
    type: z.literal("ui"),
    component: ChatUIComponentSchema,
  }),
  z.object({
    type: z.literal("view"),
    view: PageViewSchema,
  }),
  z.object({
    type: z.literal("thinking"),
    content: z.string(),
  }),
  z.object({
    type: z.literal("done"),
    messageId: z.string(),
  }),
]);

export type StreamChunk = z.infer<typeof StreamChunkSchema>;
