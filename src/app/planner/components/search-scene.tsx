"use client";

import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfDay,
} from "date-fns";
import { CalendarIcon, ChevronDown, Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { PlannerSearchScene } from "@/ai/types";
import { CreateAlertButton } from "@/components/alerts/create-alert-button";
import {
  type FlightPricePoint,
  PRICE_CHART_CONFIG,
  USD_FORMATTER,
} from "@/components/flight-explorer/constants";
import { FlightOptionsList } from "@/components/flight-explorer/flight-options-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import type {
  FlightExplorerFiltersState,
  FlightPriceChartPoint,
  TimeRangeValue,
} from "@/hooks/use-flight-explorer";
import {
  DEFAULT_TIME_RANGE,
  isFullDayTimeRange,
} from "@/hooks/use-flight-explorer";
import { MaxStops, SeatType, TripType } from "@/lib/fli/models";
import { trpc } from "@/lib/trpc/react";
import { cn } from "@/lib/utils";
import type { AirportData } from "@/server/services/airports";
import type { FlightOption } from "@/server/services/flights";

interface SearchSceneProps {
  scene: PlannerSearchScene;
  airports: AirportData[];
  isLoadingAirports?: boolean;
}

type FiltersState = {
  dateRange: { from: Date; to: Date };
  departureTimeRange: TimeRangeValue;
  arrivalTimeRange: TimeRangeValue;
  airlines: string[];
  daysOfWeek: number[];
  seatType: SeatType;
  stops: MaxStops;
  searchWindowDays: number;
};

function ensureTimeRange(range: TimeRangeValue | null): TimeRangeValue {
  if (!range) {
    return { ...DEFAULT_TIME_RANGE };
  }

  let from = Math.max(0, Math.min(24, range.from || 0));
  let to = Math.max(0, Math.min(24, range.to || 24));

  if (from > to) {
    [from, to] = [to, from];
  }

  return { from, to };
}

function mapMaxStops(value: string | undefined): MaxStops {
  switch (value) {
    case "nonstop":
      return MaxStops.NON_STOP;
    case "1":
      return MaxStops.ONE_STOP_OR_FEWER;
    case "2":
      return MaxStops.TWO_OR_FEWER_STOPS;
    default:
      return MaxStops.ANY;
  }
}

function mapSeatType(value: string | undefined): SeatType {
  switch (value) {
    case "premium":
      return SeatType.PREMIUM_ECONOMY;
    case "business":
      return SeatType.BUSINESS;
    case "first":
      return SeatType.FIRST;
    default:
      return SeatType.ECONOMY;
  }
}

function mapStopsToString(stops: MaxStops): string {
  switch (stops) {
    case MaxStops.NON_STOP:
      return "nonstop";
    case MaxStops.ONE_STOP_OR_FEWER:
      return "1";
    case MaxStops.TWO_OR_FEWER_STOPS:
      return "2";
    default:
      return "any";
  }
}

function mapSeatTypeToString(seatType: SeatType): string {
  switch (seatType) {
    case SeatType.PREMIUM_ECONOMY:
      return "premium";
    case SeatType.BUSINESS:
      return "business";
    case SeatType.FIRST:
      return "first";
    default:
      return "economy";
  }
}

export function SearchScene({
  scene,
  airports,
  isLoadingAirports = false,
}: SearchSceneProps) {
  const {
    origin: originCodes,
    destination: destinationCodes,
    startDate,
    endDate,
  } = scene.data;

  // Find airports from codes
  const originAirports = useMemo(
    () => airports.filter((a) => originCodes.includes(a.iata)),
    [airports, originCodes],
  );

  const destinationAirports = useMemo(
    () => airports.filter((a) => destinationCodes.includes(a.iata)),
    [airports, destinationCodes],
  );

  // Initialize filters from scene data
  const initialFilters = useMemo<FiltersState>(() => {
    const parsedStart = parseISO(startDate);
    const parsedEnd = parseISO(endDate);
    const windowDays =
      scene.data.searchWindowDays ??
      Math.max(
        1,
        Math.min(180, differenceInCalendarDays(parsedEnd, parsedStart) + 1),
      );

    return {
      dateRange: {
        from: startOfDay(parsedStart),
        to: startOfDay(parsedEnd),
      },
      departureTimeRange: ensureTimeRange({
        from: scene.data.departureTimeFrom ?? 0,
        to: scene.data.departureTimeTo ?? 24,
      }),
      arrivalTimeRange: ensureTimeRange({
        from: scene.data.arrivalTimeFrom ?? 0,
        to: scene.data.arrivalTimeTo ?? 24,
      }),
      airlines: scene.data.airlines ?? [],
      daysOfWeek: scene.data.daysOfWeek ?? [],
      seatType: mapSeatType(scene.data.seatType),
      stops: mapMaxStops(scene.data.maxStops),
      searchWindowDays: windowDays,
    };
  }, [scene.data, startDate, endDate]);

  // Local state
  const [filters, setFilters] = useState<FiltersState>(initialFilters);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedPriceIndex, setSelectedPriceIndex] = useState<number | null>(
    null,
  );
  const [flightPrices, setFlightPrices] = useState<FlightPricePoint[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [flightOptions, setFlightOptions] = useState<FlightOption[]>([]);
  const [isFlightOptionsLoading, setIsFlightOptionsLoading] = useState(false);
  const [flightOptionsError, setFlightOptionsError] = useState<string | null>(
    null,
  );
  const [showAdditionalFilters, setShowAdditionalFilters] = useState(false);

  // Update filters when scene changes
  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  // tRPC mutations
  const flightsDatesMutation = trpc.useMutation(["flights.dates"], {
    onError: (error) => {
      if (
        error?.message?.includes("AbortError") ||
        error?.message?.includes("aborted")
      ) {
        return;
      }
      console.error("Flight dates search error:", error);
      setSearchError(error?.message ?? "Failed to search flight dates");
    },
  });

  const flightsSearchMutation = trpc.useMutation(["flights.search"], {
    onError: (error) => {
      if (
        error?.message?.includes("AbortError") ||
        error?.message?.includes("aborted")
      ) {
        return;
      }
      console.error("Flight search error:", error);
      setFlightOptionsError(error?.message ?? "Failed to search flights");
    },
  });

  const latestSearchRequestRef = useRef(0);
  const latestFlightOptionsRequestRef = useRef(0);

  // Search functionality
  const performSearch = useCallback(async () => {
    if (originAirports.length === 0 || destinationAirports.length === 0) {
      return;
    }

    setSearchError(null);
    const requestId = latestSearchRequestRef.current + 1;
    latestSearchRequestRef.current = requestId;

    try {
      const normalizedDeparture = !isFullDayTimeRange(
        filters.departureTimeRange,
      )
        ? {
            from: filters.departureTimeRange.from,
            to: filters.departureTimeRange.to,
          }
        : undefined;

      const normalizedArrival = !isFullDayTimeRange(filters.arrivalTimeRange)
        ? {
            from: filters.arrivalTimeRange.from,
            to: filters.arrivalTimeRange.to,
          }
        : undefined;

      const payload = {
        tripType: TripType.ONE_WAY,
        segments: [
          {
            origin: originAirports[0].iata,
            destination: destinationAirports[0].iata,
            departureDate: format(filters.dateRange.from, "yyyy-MM-dd"),
            ...(normalizedDeparture && {
              departureTimeRange: normalizedDeparture,
            }),
            ...(normalizedArrival && { arrivalTimeRange: normalizedArrival }),
          },
        ],
        passengers: {
          adults: scene.data.adults ?? 1,
          children: scene.data.children ?? 0,
          infantsInSeat: 0,
          infantsOnLap: 0,
        },
        dateRange: {
          from: format(filters.dateRange.from, "yyyy-MM-dd"),
          to: format(filters.dateRange.to, "yyyy-MM-dd"),
        },
        ...(filters.seatType !== SeatType.ECONOMY && {
          seatType: filters.seatType,
        }),
        ...(filters.stops !== MaxStops.ANY && { stops: filters.stops }),
        ...(filters.airlines.length > 0 && { airlines: filters.airlines }),
        ...(filters.daysOfWeek.length > 0 && {
          daysOfWeek: filters.daysOfWeek,
        }),
      };

      const response = await flightsDatesMutation.mutateAsync(payload);

      if (latestSearchRequestRef.current !== requestId) {
        return;
      }

      const sanitized = Array.isArray(response?.prices)
        ? response.prices
            .filter(
              (item): item is { date: string; price: number } =>
                item !== null &&
                typeof item === "object" &&
                typeof item.date === "string" &&
                typeof item.price === "number",
            )
            .map((item) => ({ date: item.date, price: item.price }))
        : [];

      sanitized.sort((a, b) => a.date.localeCompare(b.date));
      setFlightPrices(sanitized);
    } catch (error) {
      if (latestSearchRequestRef.current !== requestId) {
        return;
      }

      setFlightPrices([]);
      setSearchError(
        error instanceof Error && error.message
          ? error.message
          : "Failed to search flights",
      );
    }
  }, [
    originAirports,
    destinationAirports,
    filters,
    scene.data.adults,
    scene.data.children,
    flightsDatesMutation,
  ]);

  // Auto-search when scene data changes (agent updates)
  const hasSearchedRef = useRef(false);
  useEffect(() => {
    // Only auto-search if we have valid data and haven't searched yet
    if (
      originAirports.length > 0 &&
      destinationAirports.length > 0 &&
      !hasSearchedRef.current
    ) {
      hasSearchedRef.current = true;
      void performSearch();
    }
  }, [originAirports, destinationAirports, performSearch]);

  // Load flight options for a specific date
  const loadFlightOptions = useCallback(
    async (isoDate: string) => {
      if (originAirports.length === 0 || destinationAirports.length === 0) {
        return;
      }

      const requestId = latestFlightOptionsRequestRef.current + 1;
      latestFlightOptionsRequestRef.current = requestId;
      setIsFlightOptionsLoading(true);
      setFlightOptionsError(null);
      setFlightOptions([]);

      try {
        const normalizedDeparture = !isFullDayTimeRange(
          filters.departureTimeRange,
        )
          ? {
              from: filters.departureTimeRange.from,
              to: filters.departureTimeRange.to,
            }
          : undefined;

        const normalizedArrival = !isFullDayTimeRange(filters.arrivalTimeRange)
          ? {
              from: filters.arrivalTimeRange.from,
              to: filters.arrivalTimeRange.to,
            }
          : undefined;

        const payload = {
          tripType: TripType.ONE_WAY,
          segments: [
            {
              origin: originAirports[0].iata,
              destination: destinationAirports[0].iata,
              departureDate: isoDate,
              ...(normalizedDeparture && {
                departureTimeRange: normalizedDeparture,
              }),
              ...(normalizedArrival && { arrivalTimeRange: normalizedArrival }),
            },
          ],
          passengers: {
            adults: scene.data.adults ?? 1,
            children: scene.data.children ?? 0,
            infantsInSeat: 0,
            infantsOnLap: 0,
          },
          dateRange: { from: isoDate, to: isoDate },
          ...(filters.seatType !== SeatType.ECONOMY && {
            seatType: filters.seatType,
          }),
          ...(filters.stops !== MaxStops.ANY && { stops: filters.stops }),
          ...(filters.airlines.length > 0 && { airlines: filters.airlines }),
        };

        const result = await flightsSearchMutation.mutateAsync(payload);
        if (latestFlightOptionsRequestRef.current !== requestId) {
          return;
        }
        setFlightOptions(Array.isArray(result) ? result : []);
      } catch (error) {
        if (latestFlightOptionsRequestRef.current !== requestId) {
          return;
        }
        setFlightOptions([]);
        setFlightOptionsError(
          error instanceof Error && error.message
            ? error.message
            : "Failed to load flight options",
        );
      } finally {
        if (latestFlightOptionsRequestRef.current === requestId) {
          setIsFlightOptionsLoading(false);
        }
      }
    },
    [
      originAirports,
      destinationAirports,
      filters,
      scene.data.adults,
      scene.data.children,
      flightsSearchMutation,
    ],
  );

  // Chart data
  const chartData = useMemo<FlightPriceChartPoint[]>(() => {
    const sorted = [...flightPrices].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    return sorted.map((entry) => {
      const parsedDate = parseISO(entry.date);
      return {
        ...entry,
        formattedDate: format(parsedDate, "MMM d"),
      };
    });
  }, [flightPrices]);

  const cheapestEntry = useMemo(() => {
    if (flightPrices.length === 0) {
      return null;
    }
    return flightPrices.reduce((lowest, current) =>
      current.price < lowest.price ? current : lowest,
    );
  }, [flightPrices]);

  // Filters state
  const filtersState: FlightExplorerFiltersState = {
    dateRange: filters.dateRange,
    departureTimeRange: filters.departureTimeRange,
    arrivalTimeRange: filters.arrivalTimeRange,
    airlines: filters.airlines,
    daysOfWeek: filters.daysOfWeek,
    seatType: filters.seatType,
    stops: filters.stops,
    searchWindowDays: filters.searchWindowDays,
    hasCustomFilters: false,
    hasPendingChanges: false,
    onDateRangeChange: (range) => {
      const windowDays = Math.max(
        1,
        Math.min(180, differenceInCalendarDays(range.to, range.from) + 1),
      );
      const adjustedTo = addDays(range.from, windowDays - 1);
      setFilters((prev) => ({
        ...prev,
        dateRange: { from: startOfDay(range.from), to: startOfDay(adjustedTo) },
        searchWindowDays: windowDays,
      }));
    },
    onDepartureTimeRangeChange: (range) => {
      setFilters((prev) => ({
        ...prev,
        departureTimeRange: ensureTimeRange(range),
      }));
    },
    onArrivalTimeRangeChange: (range) => {
      setFilters((prev) => ({
        ...prev,
        arrivalTimeRange: ensureTimeRange(range),
      }));
    },
    onAirlinesChange: (codes) => {
      setFilters((prev) => ({ ...prev, airlines: codes }));
    },
    onDaysOfWeekChange: (days) => {
      setFilters((prev) => ({ ...prev, daysOfWeek: days }));
    },
    onSeatTypeChange: (seatType) => {
      setFilters((prev) => ({ ...prev, seatType }));
    },
    onStopsChange: (stops) => {
      setFilters((prev) => ({ ...prev, stops }));
    },
    onSearchWindowDaysChange: (days) => {
      const adjustedTo = addDays(filters.dateRange.from, days - 1);
      setFilters((prev) => ({
        ...prev,
        dateRange: { ...prev.dateRange, to: startOfDay(adjustedTo) },
        searchWindowDays: days,
      }));
    },
    onReset: () => {
      setFilters(initialFilters);
    },
  };

  return (
    <div className="flex flex-col h-full">
      {/* Compact Route Header */}
      <div className="border-b bg-background p-4">
        <div className="space-y-3">
          {/* Loading State */}
          {isLoadingAirports && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <p className="text-sm">Loading airport data...</p>
            </div>
          )}

          {/* Empty State - No airports found */}
          {!isLoadingAirports &&
            originAirports.length === 0 &&
            destinationAirports.length === 0 && (
              <div className="rounded-md border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950 p-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  No airport data available. Please try refreshing the page.
                </p>
              </div>
            )}

          {/* Origin Row */}
          {!isLoadingAirports && originAirports.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">From</Label>
              <div className="flex flex-wrap gap-2">
                {originAirports.map((airport) => (
                  <Badge
                    key={airport.iata}
                    variant="secondary"
                    className="font-normal"
                  >
                    {airport.iata} - {airport.city}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Destination Row */}
          {!isLoadingAirports && destinationAirports.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">To</Label>
              <div className="flex flex-wrap gap-2">
                {destinationAirports.map((airport) => (
                  <Badge
                    key={airport.iata}
                    variant="secondary"
                    className="font-normal"
                  >
                    {airport.iata} - {airport.city}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Search Button */}
          <Button
            onClick={() => {
              hasSearchedRef.current = true;
              void performSearch();
            }}
            disabled={
              flightsDatesMutation.isLoading ||
              originAirports.length === 0 ||
              destinationAirports.length === 0
            }
            className="w-full"
            size="sm"
          >
            <Search className="h-4 w-4 mr-2" />
            {flightsDatesMutation.isLoading ? "Searching..." : "Search Flights"}
          </Button>
        </div>
      </div>

      {/* Filters and Results */}
      <div
        id="flight-price-panel-scroll"
        className="flex-1 overflow-auto bg-muted/10"
      >
        <div className="container mx-auto flex flex-col gap-4 p-4">
          {/* Primary Filters */}
          <div className="space-y-4 rounded-lg border bg-card p-4">
            <h3 className="font-semibold text-sm">Refine Results</h3>

            {/* Date Range */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Travel Dates
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <span className="text-sm">
                      {format(filters.dateRange.from, "MMM d, yyyy")} -{" "}
                      {format(filters.dateRange.to, "MMM d, yyyy")}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={filters.dateRange}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        filtersState.onDateRangeChange({
                          from: range.from,
                          to: range.to,
                        });
                      }
                    }}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Cabin Class */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Cabin Class
              </Label>
              <Select
                value={mapSeatTypeToString(filters.seatType)}
                onValueChange={(value) =>
                  filtersState.onSeatTypeChange(mapSeatType(value))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="economy">Economy</SelectItem>
                  <SelectItem value="premium">Premium Economy</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="first">First Class</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Stops */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Stops</Label>
              <Select
                value={mapStopsToString(filters.stops)}
                onValueChange={(value) =>
                  filtersState.onStopsChange(mapMaxStops(value))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any number of stops</SelectItem>
                  <SelectItem value="nonstop">Nonstop only</SelectItem>
                  <SelectItem value="1">1 stop or fewer</SelectItem>
                  <SelectItem value="2">2 stops or fewer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search Window */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Search Window: {filters.searchWindowDays} days
              </Label>
              <Slider
                value={[filters.searchWindowDays]}
                onValueChange={([value]) =>
                  filtersState.onSearchWindowDaysChange(value)
                }
                min={7}
                max={180}
                step={1}
                className="w-full"
              />
            </div>

            {/* Additional Filters Toggle */}
            <Collapsible
              open={showAdditionalFilters}
              onOpenChange={setShowAdditionalFilters}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between"
                >
                  <span className="text-sm">Additional Filters</span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      showAdditionalFilters && "rotate-180",
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                {/* Departure Time */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Departure Time: {filters.departureTimeRange.from}:00 -{" "}
                    {filters.departureTimeRange.to}:00
                  </Label>
                  <Slider
                    value={[
                      filters.departureTimeRange.from,
                      filters.departureTimeRange.to,
                    ]}
                    onValueChange={([from, to]) =>
                      filtersState.onDepartureTimeRangeChange({ from, to })
                    }
                    min={0}
                    max={24}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Arrival Time */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Arrival Time: {filters.arrivalTimeRange.from}:00 -{" "}
                    {filters.arrivalTimeRange.to}:00
                  </Label>
                  <Slider
                    value={[
                      filters.arrivalTimeRange.from,
                      filters.arrivalTimeRange.to,
                    ]}
                    onValueChange={([from, to]) =>
                      filtersState.onArrivalTimeRangeChange({ from, to })
                    }
                    min={0}
                    max={24}
                    step={1}
                    className="w-full"
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Price Chart */}
          {chartData.length > 0 && !searchError && (
            <Card className="space-y-6 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">
                    Cheapest fares over the next {filters.searchWindowDays} days
                  </p>
                  {cheapestEntry && (
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(cheapestEntry.date), "MMM d")} •{" "}
                      {USD_FORMATTER.format(cheapestEntry.price)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  {flightsDatesMutation.isLoading && (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                  )}
                  <CreateAlertButton
                    originAirport={originAirports[0] || null}
                    destinationAirport={destinationAirports[0] || null}
                    filters={filtersState}
                  />
                </div>
              </div>

              <ChartContainer
                config={PRICE_CHART_CONFIG}
                className="h-64 w-full"
              >
                <LineChart
                  data={chartData}
                  margin={{ left: 12, right: 12 }}
                  onClick={(data) => {
                    if (data?.activePayload?.[0]?.payload?.date) {
                      const isoDate = data.activePayload[0].payload.date;
                      setSelectedDate(isoDate);
                      const index = flightPrices.findIndex(
                        (entry) => entry.date === isoDate,
                      );
                      setSelectedPriceIndex(index >= 0 ? index : null);
                      void loadFlightOptions(isoDate);
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
                    tickFormatter={(value: number) =>
                      USD_FORMATTER.format(value)
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
                          return "";
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
            </Card>
          )}

          {/* Search Error */}
          {searchError && (
            <Card className="p-4">
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {searchError}
              </div>
            </Card>
          )}

          {/* Empty State */}
          {chartData.length === 0 &&
            !searchError &&
            !flightsDatesMutation.isLoading && (
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">
                  No results found. Try adjusting your filters or search
                  criteria.
                </p>
              </Card>
            )}

          {/* Flight Options */}
          {chartData.length > 0 && !searchError && (
            <Card className="space-y-4 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold">
                    Choose a travel date
                  </h4>
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
                      disabled={chartData.length === 0}
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
                      selected={
                        selectedDate ? parseISO(selectedDate) : undefined
                      }
                      onSelect={(date) => {
                        if (!date) {
                          setSelectedDate(null);
                          setSelectedPriceIndex(null);
                          return;
                        }
                        const isoDate = format(date, "yyyy-MM-dd");
                        setSelectedDate(isoDate);
                        const index = flightPrices.findIndex(
                          (entry) => entry.date === isoDate,
                        );
                        setSelectedPriceIndex(index >= 0 ? index : null);
                        void loadFlightOptions(isoDate);
                      }}
                      disabled={(date) => {
                        if (chartData.length === 0) return true;
                        const firstDate = parseISO(chartData[0].date);
                        const lastDate = parseISO(
                          chartData[chartData.length - 1].date,
                        );
                        return date < firstDate || date > lastDate;
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {selectedPriceIndex !== null && chartData[selectedPriceIndex] && (
                <div className="flex flex-col gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-0.5">
                    <span className="font-semibold">
                      {format(
                        parseISO(chartData[selectedPriceIndex].date),
                        "EEEE, MMM d",
                      )}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Calendar fare •{" "}
                      {USD_FORMATTER.format(
                        chartData[selectedPriceIndex].price,
                      )}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-start sm:self-auto"
                    onClick={() => {
                      setSelectedDate(null);
                      setSelectedPriceIndex(null);
                    }}
                  >
                    Clear selection
                  </Button>
                </div>
              )}

              <FlightOptionsList
                options={flightOptions}
                selectedDate={selectedDate}
                isLoading={isFlightOptionsLoading}
                error={flightOptionsError}
                awardTrips={[]}
                airports={airports}
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
