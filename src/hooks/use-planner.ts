"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/trpc/react";
import type { PlanItineraryInput } from "@/server/schemas/planner";

/**
 * Hook for managing planner state and interactions
 * Handles prompt submission, loading states, and results
 */

export type PlannerStatus = "idle" | "planning" | "success" | "error";

export interface UsePlannerState {
  prompt: string;
  status: PlannerStatus;
  result: React.ReactNode | null;
  error: string | null;
}

export interface UsePlannerActions {
  setPrompt: (prompt: string) => void;
  submitPrompt: () => Promise<void>;
  reset: () => void;
}

export interface UsePlannerReturn extends UsePlannerState, UsePlannerActions {
  isPlanning: boolean;
  canSubmit: boolean;
}

export function usePlanner(): UsePlannerReturn {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<PlannerStatus>("idle");
  const [result, setResult] = useState<React.ReactNode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const planMutation = api.planner.plan.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setStatus("success");
      setError(null);
    },
    onError: (err) => {
      setError(err.message || "Failed to plan itinerary");
      setStatus("error");
      setResult(null);
    },
  });

  const submitPrompt = useCallback(async () => {
    if (!prompt.trim()) {
      return;
    }

    setStatus("planning");
    setError(null);
    setResult(null);

    const input: PlanItineraryInput = {
      prompt: prompt.trim(),
    };

    try {
      await planMutation.mutateAsync(input);
    } catch (err) {
      // Error handled by onError callback
      console.error("Plan submission error:", err);
    }
  }, [prompt, planMutation]);

  const reset = useCallback(() => {
    setPrompt("");
    setStatus("idle");
    setResult(null);
    setError(null);
  }, []);

  return {
    prompt,
    status,
    result,
    error,
    isPlanning: status === "planning",
    canSubmit: prompt.trim().length > 0 && status !== "planning",
    setPrompt,
    submitPrompt,
    reset,
  };
}
