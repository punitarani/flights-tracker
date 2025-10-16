"use client";

import { RefreshCw } from "lucide-react";
import { usePlanner } from "@/hooks/use-planner";
import { Button } from "@/components/ui/button";
import { PlannerPromptForm } from "./planner-prompt-form";

export function PlannerShell() {
  const {
    prompt,
    status,
    result,
    error,
    isPlanning,
    canSubmit,
    setPrompt,
    submitPrompt,
    reset,
  } = usePlanner();

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      {/* Header */}
      <div className="space-y-2 text-center">
        <h1 className="text-4xl font-bold tracking-tight">AI Flight Planner</h1>
        <p className="text-muted-foreground">
          Tell me what you're looking for, and I'll find the perfect flights
        </p>
      </div>

      {/* Prompt Form */}
      <PlannerPromptForm
        value={prompt}
        onChange={setPrompt}
        onSubmit={submitPrompt}
        isPlanning={isPlanning}
        canSubmit={canSubmit}
      />

      {/* Results */}
      {(result || error) && (
        <div className="space-y-4">
          {result && <div>{result}</div>}
          
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {status !== "planning" && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={reset}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Plan Another Trip
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Tips */}
      {status === "idle" && (
        <div className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
          <p className="font-medium">Tips for better results:</p>
          <ul className="mt-2 space-y-1 pl-4">
            <li>• Include origin and destination cities or airport codes</li>
            <li>• Specify your travel dates or time frame</li>
            <li>• Mention your budget if you have one</li>
            <li>• Add preferences like non-stop flights or specific airlines</li>
          </ul>
        </div>
      )}
    </div>
  );
}
