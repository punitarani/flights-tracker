"use client";

import { format, parseISO } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type {
  FlightExplorerFiltersState,
  FlightExplorerPriceState,
} from "@/hooks/use-flight-explorer";
import { PRICE_CHART_CONFIG, USD_FORMATTER } from "./constants";
import { FlightFiltersPanel } from "./flight-filters-panel";
import { FlightOptionsList } from "./flight-options-list";

type FlightPricePanelProps = {
  state: FlightExplorerPriceState;
  filters: FlightExplorerFiltersState;
};

function toIsoDate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function FlightPricePanel({ state, filters }: FlightPricePanelProps) {
  const {
    shouldShowPanel,
    chartData,
    cheapestEntry,
    searchError,
    isSearching,
    searchWindowDays,
    selectedDate,
    selectedPriceIndex,
    flightOptions,
    isFlightOptionsLoading,
    flightOptionsError,
    canRefetch,
    onRefetch,
    onSelectDate,
  } = state;

  if (!shouldShowPanel) {
    return null;
  }

  const firstChartDate = chartData.length ? parseISO(chartData[0].date) : null;
  const lastChartDate = chartData.length
    ? parseISO(chartData[chartData.length - 1].date)
    : null;

  const currentSelection =
    selectedPriceIndex !== null && chartData[selectedPriceIndex]
      ? chartData[selectedPriceIndex]
      : null;

  return (
    <div className="h-full w-full overflow-auto bg-muted/10">
      <div className="container mx-auto flex flex-col gap-4 p-4">
        <FlightFiltersPanel
          filters={filters}
          price={{ isSearching, canRefetch, onRefetch }}
        />

        <Card className="space-y-6 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold">
                Cheapest fares over the next {searchWindowDays} days
              </p>
              {cheapestEntry && (
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(cheapestEntry.date), "MMM d")} •{" "}
                  {USD_FORMATTER.format(cheapestEntry.price)}
                </p>
              )}
              {!cheapestEntry && !isSearching && !searchError && (
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
              <LineChart
                data={chartData}
                margin={{ left: 12, right: 12 }}
                onClick={(data) => {
                  if (data?.activePayload?.[0]?.payload?.date) {
                    onSelectDate(data.activePayload[0].payload.date);
                  }
                }}
                className="cursor-pointer"
              >
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
                      labelFormatter={(_, items) => {
                        const isoDate = items?.[0]?.payload?.date;
                        if (typeof isoDate === "string") {
                          const parsed = parseISO(isoDate);
                          if (!Number.isNaN(parsed.getTime())) {
                            return format(parsed, "EEE, MMM d");
                          }
                        }
                        const fallback = items?.[0]?.payload?.formattedDate;
                        return typeof fallback === "string" ? fallback : "";
                      }}
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
                  dot={{ r: 2, cursor: "pointer" }}
                  activeDot={{ r: 5, cursor: "pointer" }}
                />
              </LineChart>
            </ChartContainer>
          ) : null}

          {chartData.length === 0 && !searchError ? (
            <p className="text-xs text-muted-foreground">
              Adjust your filters or search window to uncover more fares.
            </p>
          ) : null}
        </Card>

        {chartData.length > 0 && !searchError ? (
          <Card className="space-y-4 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">Choose a travel date</h4>
                <p className="text-xs text-muted-foreground">
                  Click a date on the chart or pick from the calendar to load
                  detailed flight options.
                </p>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 gap-2"
                    disabled={!firstChartDate || !lastChartDate}
                  >
                    <CalendarIcon className="h-4 w-4" aria-hidden="true" />
                    {selectedDate
                      ? format(parseISO(selectedDate), "EEE, MMM d")
                      : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate ? parseISO(selectedDate) : undefined}
                    onSelect={(date) => {
                      if (!date) {
                        onSelectDate(null);
                        return;
                      }
                      onSelectDate(toIsoDate(date));
                    }}
                    disabled={(date) => {
                      if (!firstChartDate || !lastChartDate) {
                        return false;
                      }
                      return date < firstChartDate || date > lastChartDate;
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {currentSelection ? (
              <div className="flex flex-col gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5">
                  <span className="font-semibold">
                    {format(parseISO(currentSelection.date), "EEEE, MMM d")}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Calendar fare •{" "}
                    {USD_FORMATTER.format(currentSelection.price)}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start sm:self-auto"
                  onClick={() => onSelectDate(null)}
                >
                  Clear selection
                </Button>
              </div>
            ) : null}

            <FlightOptionsList
              options={flightOptions}
              selectedDate={selectedDate}
              isLoading={isFlightOptionsLoading}
              error={flightOptionsError}
            />
          </Card>
        ) : null}
      </div>
    </div>
  );
}
