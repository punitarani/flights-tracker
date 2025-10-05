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
import { Slider } from "@/components/ui/slider";
import { PRICE_CHART_CONFIG, USD_FORMATTER } from "./constants";
import { FlightFiltersPanel } from "./flight-filters-panel";
import { FlightOptionsList } from "./flight-options-list";
import type {
  FlightExplorerFiltersState,
  FlightExplorerPriceState,
} from "./use-flight-explorer";

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
    hasSearched,
    searchWindowDays,
    selectedDate,
    selectedPriceIndex,
    flightOptions,
    isFlightOptionsLoading,
    flightOptionsError,
    canRefetch,
    onRefetch,
    onSelectPriceIndex,
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

  const sliderMax = chartData.length > 0 ? chartData.length - 1 : 0;
  const sliderValue =
    selectedPriceIndex !== null
      ? selectedPriceIndex
      : chartData.length > 0
        ? 0
        : 0;

  return (
    <div className="h-full w-full overflow-auto bg-muted/10">
      <div className="container mx-auto flex flex-col gap-4 p-4">
        <FlightFiltersPanel
          filters={filters}
          price={{ hasSearched, isSearching, canRefetch, onRefetch }}
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

          {chartData.length === 0 && !searchError && hasSearched ? (
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
                  Drag the slider or pick a date to load detailed flight
                  options.
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
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Slider
              min={0}
              max={sliderMax}
              step={1}
              defaultValue={[0]}
              value={selectedPriceIndex !== null ? [sliderValue] : undefined}
              disabled={chartData.length <= 1 || isSearching}
              onValueChange={(values) => {
                if (!values.length) return;
                onSelectPriceIndex(values[0]);
              }}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {firstChartDate ? format(firstChartDate, "MMM d") : ""}
              </span>
              <span>{lastChartDate ? format(lastChartDate, "MMM d") : ""}</span>
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
            ) : (
              <p className="text-xs text-muted-foreground">
                Select a price point above to load detailed flight options.
              </p>
            )}

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
