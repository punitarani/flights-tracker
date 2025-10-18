"use client";

import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface LoadingToolCardProps {
  toolName: string;
  args?: Record<string, unknown>;
}

/**
 * Loading state card for tool execution
 * Shows animated loader with tool context
 */
export function LoadingToolCard({ toolName, args }: LoadingToolCardProps) {
  const labels: Record<string, string> = {
    analyzeRoute: "Analyzing route...",
    searchCalendarPrices: "Searching prices across dates...",
    searchFlightDetails: "Finding flight details...",
  };

  const label = labels[toolName] || "Processing...";

  // Extract relevant args for display
  const displayArgs = args
    ? Object.entries(args)
        .filter(([key]) =>
          [
            "origin",
            "destination",
            "dateFrom",
            "dateTo",
            "departureDate",
          ].includes(key),
        )
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ")
    : "";

  return (
    <Card className="border-dashed border-primary/50 bg-primary/5">
      <CardContent className="py-6 space-y-3">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">{label}</p>
            {displayArgs && (
              <p className="text-xs text-muted-foreground mt-1">
                {displayArgs}
              </p>
            )}
          </div>
        </div>
        <Progress value={undefined} className="h-1" />
      </CardContent>
    </Card>
  );
}
