"use client";

import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";

interface ChatInputProps {
  input: string;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  disabled?: boolean;
  placeholder?: string;
  status?: "ready" | "submitted" | "streaming" | "error";
}

/**
 * Chat input using AI Elements PromptInput
 * Simple 2-line input with submit button
 */
export function ChatInput({
  input,
  onInputChange,
  onSubmit,
  disabled,
  placeholder = "Ask me about flights...",
  status = "ready",
}: ChatInputProps) {
  const handlePromptSubmit = (
    _message: PromptInputMessage,
    event: React.FormEvent,
  ) => {
    onSubmit(event);
  };

  return (
    <PromptInput
      onSubmit={handlePromptSubmit}
      className="border-t bg-background/95 backdrop-blur p-4"
    >
      <PromptInputBody>
        <PromptInputTextarea
          value={input}
          onChange={onInputChange}
          placeholder={placeholder}
          disabled={disabled}
          rows={2}
        />
      </PromptInputBody>
      <PromptInputFooter className="flex justify-end">
        <PromptInputSubmit
          status={status}
          disabled={!input.trim() || disabled}
        />
      </PromptInputFooter>
    </PromptInput>
  );
}
