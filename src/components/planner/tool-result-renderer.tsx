"use client";

import {
  ErrorCard,
  FlightListCard,
  LoadingToolCard,
  PriceCalendarCard,
  RouteAnalysisCard,
} from "./tool-results";

interface ToolResultRendererProps {
  toolName: string;
  result?: unknown;
  state?: "call" | "result" | "partial-call";
  args?: unknown;
  onAction?: (action: string, data: unknown) => void;
}

/**
 * Central tool result renderer
 * Maps tool names to appropriate custom UI components
 */
export function ToolResultRenderer({
  toolName,
  result,
  state = "result",
  args,
  onAction,
}: ToolResultRendererProps) {
  // Show loading state for in-progress tool calls
  if (state === "call" || state === "partial-call") {
    return <LoadingToolCard toolName={toolName} args={args} />;
  }

  // Handle errors
  if (result?.error) {
    return (
      <ErrorCard
        toolName={toolName}
        error={result.error}
        onRetry={() => onAction?.("retry", { toolName, args })}
      />
    );
  }

  // Render appropriate component based on tool name
  switch (toolName) {
    case "analyzeRoute":
      if (result?.origin && result?.destination) {
        return (
          <RouteAnalysisCard
            {...result}
            onViewOnMap={() =>
              onAction?.("viewOnMap", {
                origin: result.origin,
                destination: result.destination,
              })
            }
          />
        );
      }
      break;

    case "searchCalendarPrices":
      if (result?.prices && result.prices.length > 0) {
        return (
          <PriceCalendarCard
            {...result}
            onSearchDate={(date) =>
              onAction?.("searchDate", {
                origin: args?.origin,
                destination: args?.destination,
                date,
              })
            }
          />
        );
      }
      break;

    case "searchFlightDetails":
      if (result?.flights && result.flights.length > 0) {
        return (
          <FlightListCard
            {...result}
            onViewDetails={(flight) => onAction?.("viewFlightDetails", flight)}
          />
        );
      }
      break;
  }

  // Fallback: simple JSON display
  return (
    <div className="rounded-lg bg-muted/20 px-3 py-2 text-sm">
      <span className="font-medium text-muted-foreground">{toolName}</span>
      <div className="mt-1 text-xs text-muted-foreground/80">
        {JSON.stringify(result).substring(0, 100)}...
      </div>
    </div>
  );
}
