"use client";

import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

interface PlannerPromptFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isPlanning: boolean;
  canSubmit: boolean;
}

const QUICK_PROMPTS = [
  "Find me a cheap flight from NYC to LA next month",
  "I want to go somewhere warm in February under $500",
  "Show me weekend flights from Chicago to Miami",
  "Best time to fly from SF to Tokyo this year?",
];

export function PlannerPromptForm({
  value,
  onChange,
  onSubmit,
  isPlanning,
  canSubmit,
}: PlannerPromptFormProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && canSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Describe your ideal trip</span>
          </div>
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., I need a flight from San Francisco to New York in March under $300"
            className="min-h-[120px] resize-none"
            disabled={isPlanning}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.slice(0, 2).map((prompt) => (
              <Button
                key={prompt}
                variant="outline"
                size="sm"
                onClick={() => onChange(prompt)}
                disabled={isPlanning}
                className="text-xs"
              >
                {prompt.slice(0, 30)}...
              </Button>
            ))}
          </div>
          <Button
            onClick={onSubmit}
            disabled={!canSubmit}
            size="lg"
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            Plan Trip
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
