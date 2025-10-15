"use client";

import { addYears, format, parseISO, startOfToday } from "date-fns";
import { Calendar, Loader2, Plane } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { SeatsAeroAvailabilityTripModel } from "@/lib/fli/models/seats-aero";
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
};

type CabinSummary = {
  cabin: "Economy" | "Premium Economy" | "Business" | "First";
  cabinKey: "economy" | "premium_economy" | "business" | "first";
  minMileage: number | null;
  directMinMileage: number | null;
  tripCount: number;
};

function extractCabinSummaries(
  trips: SeatsAeroAvailabilityTripModel[],
): CabinSummary[] {
  const cabinMap = new Map<string, CabinSummary>();

  const cabinLabels: Record<
    string,
    "Economy" | "Premium Economy" | "Business" | "First"
  > = {
    economy: "Economy",
    premium_economy: "Premium Economy",
    business: "Business",
    first: "First",
  };

  for (const trip of trips) {
    const key = trip.cabinClass;
    const existing = cabinMap.get(key);

    if (!existing) {
      cabinMap.set(key, {
        cabin: cabinLabels[key] || "Economy",
        cabinKey: key as "economy" | "premium_economy" | "business" | "first",
        minMileage: trip.mileageCost,
        directMinMileage: trip.stops === 0 ? trip.mileageCost : null,
        tripCount: 1,
      });
    } else {
      // Update min mileage
      if (trip.mileageCost < (existing.minMileage ?? Infinity)) {
        existing.minMileage = trip.mileageCost;
      }

      // Update direct min mileage
      if (trip.stops === 0) {
        if (
          existing.directMinMileage === null ||
          trip.mileageCost < existing.directMinMileage
        ) {
          existing.directMinMileage = trip.mileageCost;
        }
      }

      existing.tripCount += 1;
    }
  }

  // Sort by cabin order: Economy, Premium Economy, Business, First
  const order = ["economy", "premium_economy", "business", "first"];
  return Array.from(cabinMap.values()).sort(
    (a, b) => order.indexOf(a.cabinKey) - order.indexOf(b.cabinKey),
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
}: AwardAvailabilityPanelProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const toastIdRef = useRef<string | number | null>(null);

  // Trigger the search to populate cache
  // Always search from today to 1 year from now for comprehensive award data
  const seatsAeroStartDate = startOfToday().toISOString().split("T")[0];
  const seatsAeroEndDate = addYears(startOfToday(), 1)
    .toISOString()
    .split("T")[0];

  const { isLoading: isSearching } = trpc.useQuery([
    "seatsAero.search",
    {
      originAirport: originAirport.iata,
      destinationAirport: destinationAirport.iata,
      startDate: seatsAeroStartDate,
      endDate: seatsAeroEndDate,
      useCache: true,
    },
  ]);

  // Show toast notification when searching for award data
  useEffect(() => {
    if (isSearching) {
      toastIdRef.current = toast.loading(
        "Live search in progress for points. Please wait 1-2 minutes.",
        { duration: 3000 },
      );
    } else if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current);
      toastIdRef.current = null;
    }
  }, [isSearching]);

  // Query 1: Get daily aggregates (for calendar view)
  const {
    data: dailyAvailability,
    isLoading: isLoadingDaily,
    error: dailyError,
  } = trpc.useQuery([
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
  ]);

  // Query 2: Get detailed flights for selected day
  const {
    data: trips,
    isLoading: isLoadingTrips,
    error: tripsError,
  } = trpc.useQuery(
    [
      "seatsAero.getTrips",
      {
        originAirport: originAirport.iata,
        destinationAirport: destinationAirport.iata,
        // biome-ignore lint/style/noNonNullAssertion: selectedDate is guaranteed to be set
        travelDate: selectedDate!,
        directOnly,
        maxStops,
        sources,
      },
    ],
    {
      enabled: !!selectedDate,
    },
  );

  const cabinSummaries = useMemo(() => {
    if (!trips) return [];
    return extractCabinSummaries(trips);
  }, [trips]);

  // Transform daily availability data into chart format
  const chartData = useMemo(() => {
    if (!dailyAvailability) return [];
    return dailyAvailability.map((day) => ({
      date: day.travelDate,
      formattedDate: format(parseISO(day.travelDate), "MMM d"),
      economy: day.economyMinMileage,
      business: day.businessMinMileage,
      first: day.firstMinMileage,
      premiumEconomy: day.premiumEconomyMinMileage,
    }));
  }, [dailyAvailability]);

  const error = dailyError || tripsError;

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

  // Format selected date for display
  const selectedDateDisplay = useMemo(() => {
    if (!selectedDate) return null;
    try {
      return format(parseISO(selectedDate), "EEEE, MMM d, yyyy");
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

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
        dailyAvailability.length === 0 && (
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
        dailyAvailability &&
        dailyAvailability.length > 0 && (
          <div className="space-y-3">
            {/* Award availability chart */}
            {!selectedDate && chartData.length > 0 && (
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
                    onClick={(data) => {
                      if (data?.activePayload?.[0]?.payload?.date) {
                        setSelectedDate(data.activePayload[0].payload.date);
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
                      tickLine={false}
                      axisLine={false}
                      width={56}
                      tickFormatter={(value: number) =>
                        `${MILEAGE_FORMATTER.format(value / 1000)}k`
                      }
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
                              ? `${MILEAGE_FORMATTER.format(value)} miles`
                              : (value ?? "N/A")
                          }
                        />
                      }
                    />
                    <ChartLegend
                      verticalAlign="bottom"
                      height={36}
                      content={<ChartLegendContent />}
                    />
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
            )}

            {/* Detailed flight list for selected date */}
            {selectedDate && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDate(null)}
                      className="h-auto px-0 text-xs hover:bg-transparent"
                    >
                      ← Back to calendar
                    </Button>
                    <p className="mt-1 text-sm font-medium">
                      {selectedDateDisplay}
                    </p>
                  </div>
                </div>

                {isLoadingTrips && (
                  <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading flights...</span>
                  </div>
                )}

                {!isLoadingTrips && cabinSummaries.length === 0 && (
                  <p className="py-2 text-sm text-muted-foreground">
                    No flights found for this date.
                  </p>
                )}

                {!isLoadingTrips && cabinSummaries.length > 0 && (
                  <div className="space-y-2">
                    {cabinSummaries.map((cabin) => (
                      <div
                        key={cabin.cabinKey}
                        className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <Plane className="h-4 w-4 text-primary" />
                          <div>
                            <span className="text-sm font-medium">
                              {cabin.cabin}
                            </span>
                            <p className="text-xs text-muted-foreground">
                              {cabin.tripCount}{" "}
                              {cabin.tripCount === 1 ? "option" : "options"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {cabin.minMileage !== null && (
                            <div className="text-sm font-semibold">
                              {MILEAGE_FORMATTER.format(cabin.minMileage)} miles
                            </div>
                          )}
                          {cabin.directMinMileage !== null && (
                            <div className="text-xs text-muted-foreground">
                              Direct:{" "}
                              {MILEAGE_FORMATTER.format(cabin.directMinMileage)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {trips && trips.length > 0 && (
                      <p className="pt-1 text-xs text-muted-foreground">
                        Showing lowest miles from {trips.length} flight
                        {trips.length === 1 ? "" : "s"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
    </Card>
  );
}
