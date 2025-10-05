"use client";

import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  MAX_SEARCH_DAYS,
  PRICE_CHART_CONFIG,
  USD_FORMATTER,
} from "./constants";
import type { FlightExplorerPriceState } from "./use-flight-explorer";

type FlightPricePanelProps = {
  state: FlightExplorerPriceState;
};

export function FlightPricePanel({ state }: FlightPricePanelProps) {
  const {
    shouldShowPanel,
    chartData,
    cheapestEntry,
    searchError,
    isSearching,
    hasSearched,
  } = state;

  if (!shouldShowPanel) {
    return null;
  }

  return (
    <div className="h-full w-full overflow-auto bg-muted/10">
      <div className="container mx-auto p-4">
        <Card className="space-y-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold">
                Cheapest fares over the next {MAX_SEARCH_DAYS} days
              </p>
              {cheapestEntry && (
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(cheapestEntry.date), "MMM d")} •{" "}
                  {USD_FORMATTER.format(cheapestEntry.price)}
                </p>
              )}
              {!cheapestEntry &&
                !isSearching &&
                !searchError &&
                hasSearched && (
                  <p className="text-xs text-muted-foreground">
                    No fares found for this route.
                  </p>
                )}
            </div>
            {isSearching ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
            ) : null}
          </div>

          {searchError ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {searchError}
            </div>
          ) : null}

          {chartData.length > 0 && !searchError ? (
            <ChartContainer config={PRICE_CHART_CONFIG} className="h-64 w-full">
              <LineChart data={chartData} margin={{ left: 12, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="formattedDate"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={16}
                />
                <YAxis
                  dataKey="price"
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={(value: number) => USD_FORMATTER.format(value)}
                />
                <ChartTooltip
                  cursor={{ strokeDasharray: "4 4" }}
                  content={
                    <ChartTooltipContent
                      labelKey="formattedDate"
                      formatter={(value) =>
                        typeof value === "number"
                          ? USD_FORMATTER.format(value)
                          : (value ?? "")
                      }
                    />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="var(--color-price)"
                  strokeWidth={2}
                  dot={{ r: 1.5 }}
                  activeDot={{ r: 3 }}
                />
              </LineChart>
            </ChartContainer>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
