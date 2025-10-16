"use client";

import { addYears, format, parseISO, startOfToday } from "date-fns";
import { Calendar, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  type TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "@/components/ui/chart";
import { trpc } from "@/lib/trpc/react";
import type { AirportData } from "@/server/services/airports";
import { AWARD_CHART_CONFIG, MILEAGE_FORMATTER } from "./constants";

type AwardAvailabilityPanelProps = {
  originAirport: AirportData;
  destinationAirport: AirportData;
  startDate: string;
  endDate: string;
  directOnly?: boolean;
  maxStops?: number;
  sources?: string[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
};

const CABIN_SORT_ORDER = [
  "economy",
  "premiumEconomy",
  "business",
  "first",
] as const;

type CabinDataKey = (typeof CABIN_SORT_ORDER)[number];

function AwardTooltipContent({
  active,
  payload,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) {
    return null;
  }

  const items = payload
    .filter((item): item is NonNullable<typeof item> =>
      Boolean(item && item.value !== undefined),
    )
    .sort((a, b) => {
      const aKey = String(a.dataKey) as CabinDataKey;
      const bKey = String(b.dataKey) as CabinDataKey;
      return CABIN_SORT_ORDER.indexOf(aKey) - CABIN_SORT_ORDER.indexOf(bKey);
    });

  if (!items.length) {
    return null;
  }

  const isoDate = items[0]?.payload?.date;
  const fallbackLabel = items[0]?.payload?.formattedDate;

  let labelText = typeof fallbackLabel === "string" ? fallbackLabel : "";
  if (typeof isoDate === "string") {
    try {
      const parsed = parseISO(isoDate);
      if (!Number.isNaN(parsed.getTime())) {
        labelText = format(parsed, "EEE, MMM d");
      }
    } catch {
      // ignore parse errors and use fallback label
    }
  }

  return (
    <div className="border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{labelText}</div>
      <div className="grid gap-1.5">
        {items.map((item) => {
          const dataKey = String(item.dataKey) as CabinDataKey;
          const config =
            AWARD_CHART_CONFIG[dataKey as keyof typeof AWARD_CHART_CONFIG];
          const color =
            item.color || `var(--color-${dataKey as string})` || "currentColor";

          return (
            <div
              key={dataKey}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <div
                  className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: color }}
                />
                <span>{config?.label ?? item.name ?? dataKey}</span>
              </div>
              <span className="text-foreground font-mono font-medium tabular-nums">
                {typeof item.value === "number"
                  ? `${MILEAGE_FORMATTER.format(item.value)} miles`
                  : item.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AwardAvailabilityPanel({
  originAirport,
  destinationAirport,
  startDate,
  endDate,
  directOnly,
  maxStops,
  sources,
  selectedDate,
  onSelectDate,
}: AwardAvailabilityPanelProps) {
  const toastIdRef = useRef<string | number | null>(null);

  // Trigger the search to populate cache
  // Always search from today to 1 year from now for comprehensive award data
  const seatsAeroStartDate = startOfToday().toISOString().split("T")[0];
  const seatsAeroEndDate = addYears(startOfToday(), 1)
    .toISOString()
    .split("T")[0];

  const { data: searchResult, isLoading: isSearching } = trpc.useQuery(
    [
      "seatsAero.search",
      {
        originAirport: originAirport.iata,
        destinationAirport: destinationAirport.iata,
        startDate: seatsAeroStartDate,
        endDate: seatsAeroEndDate,
        useCache: true,
      },
    ],
    {
      refetchInterval: (data) =>
        data?.status === "completed" || data?.status === "failed"
          ? false
          : 5000,
      refetchOnWindowFocus: false,
    },
  );

  const searchStatus = searchResult?.status;
  const isWorkflowActive =
    searchStatus === "pending" || searchStatus === "processing";
  const shouldShowSearchToast = isWorkflowActive;

  // Show toast notification when searching for award data
  useEffect(() => {
    if (shouldShowSearchToast && !toastIdRef.current) {
      toastIdRef.current = toast("Live search in progress for points", {
        description: "Please wait 1-2 minutes.",
        duration: 3000,
        icon: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
      });
    }

    if (!shouldShowSearchToast && toastIdRef.current) {
      toast.dismiss(toastIdRef.current);
      toastIdRef.current = null;
    }
  }, [shouldShowSearchToast]);

  // Query 1: Get daily aggregates (for calendar view)
  const {
    data: dailyAvailability,
    isLoading: isLoadingDaily,
    error: dailyError,
  } = trpc.useQuery(
    [
      "seatsAero.getAvailabilityByDay",
      {
        originAirport: originAirport.iata,
        destinationAirport: destinationAirport.iata,
        searchStartDate: seatsAeroStartDate,
        searchEndDate: seatsAeroEndDate,
        directOnly,
        maxStops,
        sources,
      },
    ],
    {
      refetchInterval: isWorkflowActive ? 5000 : false,
      refetchOnWindowFocus: false,
    },
  );

  const chartData = useMemo(() => {
    if (!dailyAvailability) return [];

    return dailyAvailability
      .slice()
      .sort((a, b) => a.travelDate.localeCompare(b.travelDate))
      .map((day) => {
        let formattedDate = day.travelDate;
        try {
          const parsed = parseISO(day.travelDate);
          if (!Number.isNaN(parsed.getTime())) {
            formattedDate = format(parsed, "MMM d");
          }
        } catch {
          // ignore formatting errors and fall back to ISO string
        }

        return {
          date: day.travelDate,
          formattedDate,
          economy: day.economyMinMileage,
          business: day.businessMinMileage,
          first: day.firstMinMileage,
          premiumEconomy: day.premiumEconomyMinMileage,
        };
      });
  }, [dailyAvailability]);

  const handleSelectDate = useCallback(
    (date: string | null) => {
      if (!date) {
        onSelectDate(null);
        return;
      }

      const normalized = chartData.find((entry) => entry.date === date)?.date;

      onSelectDate(normalized ?? date);
    },
    [chartData, onSelectDate],
  );

  const handleChartClick = useCallback<
    NonNullable<React.ComponentProps<typeof LineChart>["onClick"]>
  >(
    (chartEvent) => {
      const nextDate = chartEvent?.activePayload?.[0]?.payload?.date;

      if (typeof nextDate === "string") {
        handleSelectDate(nextDate);
      }
    },
    [handleSelectDate],
  );

  const selectedPoint = useMemo(
    () =>
      selectedDate
        ? (chartData.find((entry) => entry.date === selectedDate) ?? null)
        : null,
    [chartData, selectedDate],
  );

  const error = dailyError;

  const dateRangeDisplay = useMemo(() => {
    try {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
    } catch {
      return `${startDate} - ${endDate}`;
    }
  }, [startDate, endDate]);

  const isLoadingInitial = isSearching || isLoadingDaily;

  return (
    <Card className="space-y-4 p-4">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold">Award Availability</h4>
        <p className="text-xs text-muted-foreground">
          {originAirport.iata} → {destinationAirport.iata} • {dateRangeDisplay}
        </p>
      </div>

      {isLoadingInitial && (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading award availability...</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error.message || "Failed to load award availability"}
        </div>
      )}

      {!isLoadingInitial &&
        !error &&
        dailyAvailability &&
        dailyAvailability.length === 0 &&
        !isWorkflowActive && (
          <div className="py-2 text-sm text-muted-foreground">
            <p>No award availability found for this route.</p>
            <p className="mt-1 text-xs">
              Try searching the reverse route ({destinationAirport.iata} →{" "}
              {originAirport.iata}) or run a new search to populate award data.
            </p>
          </div>
        )}

      {!isLoadingInitial &&
        !error &&
        isWorkflowActive &&
        (!dailyAvailability || dailyAvailability.length === 0) && (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>
              Searching for award availability. Results will update as they are
              found.
            </span>
          </div>
        )}

      {!isLoadingInitial &&
        !error &&
        dailyAvailability &&
        dailyAvailability.length > 0 && (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>Click a date to see flight details</span>
              </div>
              <ChartContainer
                config={AWARD_CHART_CONFIG}
                className="h-64 w-full"
              >
                <LineChart
                  data={chartData}
                  margin={{ left: 12, right: 12 }}
                  onClick={handleChartClick}
                  className="cursor-pointer"
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={16}
                    tickFormatter={(value: string) => {
                      try {
                        const parsed = parseISO(value);
                        if (!Number.isNaN(parsed.getTime())) {
                          return format(parsed, "MMM d");
                        }
                      } catch {
                        // ignore parse errors and fall back to raw value
                      }
                      return (
                        chartData.find((entry) => entry.date === value)
                          ?.formattedDate ?? value
                      );
                    }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tickFormatter={(value: number) =>
                      `${MILEAGE_FORMATTER.format(value / 1000)}k`
                    }
                  />
                  <ChartTooltip
                    cursor={{ strokeDasharray: "4 4" }}
                    content={<AwardTooltipContent />}
                  />
                  <ChartLegend
                    verticalAlign="bottom"
                    height={36}
                    content={<ChartLegendContent />}
                  />
                  {selectedPoint ? (
                    <ReferenceLine
                      x={selectedPoint.date}
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="4 4"
                      isFront
                    />
                  ) : null}
                  <Line
                    type="monotone"
                    dataKey="economy"
                    stroke="var(--color-economy)"
                    strokeWidth={2}
                    dot={{ r: 2, cursor: "pointer" }}
                    activeDot={{ r: 5, cursor: "pointer" }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="business"
                    stroke="var(--color-business)"
                    strokeWidth={2}
                    dot={{ r: 2, cursor: "pointer" }}
                    activeDot={{ r: 5, cursor: "pointer" }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="first"
                    stroke="var(--color-first)"
                    strokeWidth={2}
                    dot={{ r: 2, cursor: "pointer" }}
                    activeDot={{ r: 5, cursor: "pointer" }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="premiumEconomy"
                    stroke="var(--color-premiumEconomy)"
                    strokeWidth={2}
                    dot={{ r: 2, cursor: "pointer" }}
                    activeDot={{ r: 5, cursor: "pointer" }}
                    connectNulls
                  />
                </LineChart>
              </ChartContainer>
            </div>

            <div className="text-xs text-muted-foreground">
              Select a date on the chart to load award details below.
            </div>
          </div>
        )}
    </Card>
  );
}
