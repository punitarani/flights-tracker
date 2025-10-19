"use client";

import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  startOfDay,
} from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlannerSearchScene } from "@/ai/types";
import type { FlightPricePoint } from "@/components/flight-explorer/constants";
import { FlightFiltersPanel } from "@/components/flight-explorer/flight-filters-panel";
import { FlightPricePanel } from "@/components/flight-explorer/flight-price-panel";
import { RouteSearchPanel } from "@/components/flight-explorer/route-search-panel";
import type {
  FlightExplorerFiltersState,
  FlightExplorerHeaderState,
  FlightExplorerPriceState,
  FlightExplorerSearchState,
  FlightPriceChartPoint,
  FlightSearchFieldState,
  TimeRangeValue,
} from "@/hooks/use-flight-explorer";
import {
  DEFAULT_TIME_RANGE,
  isFullDayTimeRange,
} from "@/hooks/use-flight-explorer";
import { MaxStops, SeatType, TripType } from "@/lib/fli/models";
import { trpc } from "@/lib/trpc/react";
import type { AirportData } from "@/server/services/airports";
import type { FlightOption } from "@/server/services/flights";

interface SearchSceneProps {
  scene: PlannerSearchScene;
  airports: AirportData[];
  totalAirports: number;
  isLoadingAirports: boolean;
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

function formatAirportValue(airport: AirportData): string {
  return `${airport.name} (${airport.iata})`;
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

export function SearchScene({
  scene,
  airports,
  totalAirports,
  isLoadingAirports,
}: SearchSceneProps) {
  const {
    origin: originCodes,
    destination: destinationCodes,
    startDate,
    endDate,
  } = scene.data;

  // Find airports from codes
  const originAirport = useMemo(
    () => airports.find((a) => originCodes.includes(a.iata)) || null,
    [airports, originCodes],
  );

  const destinationAirport = useMemo(
    () => airports.find((a) => destinationCodes.includes(a.iata)) || null,
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
  const [originQuery, setOriginQuery] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [activeField, setActiveField] = useState<
    "origin" | "destination" | null
  >(null);
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

  // Update queries when airports change
  useEffect(() => {
    if (originAirport) {
      setOriginQuery(formatAirportValue(originAirport));
    }
  }, [originAirport]);

  useEffect(() => {
    if (destinationAirport) {
      setDestinationQuery(formatAirportValue(destinationAirport));
    }
  }, [destinationAirport]);

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
    if (!originAirport || !destinationAirport) {
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
            origin: originAirport.iata,
            destination: destinationAirport.iata,
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
    originAirport,
    destinationAirport,
    filters,
    scene.data.adults,
    scene.data.children,
    flightsDatesMutation,
  ]);

  // Load flight options for a specific date
  const loadFlightOptions = useCallback(
    async (isoDate: string) => {
      if (!originAirport || !destinationAirport) {
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
              origin: originAirport.iata,
              destination: destinationAirport.iata,
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
      originAirport,
      destinationAirport,
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

  // Header state
  const headerState: FlightExplorerHeaderState = {
    displayMessage: `Search: ${originCodes.join("/")} → ${destinationCodes.join("/")}`,
    isInitialLoading: isLoadingAirports,
    isLoadingNearby: false,
    totalAirports,
    onShowAllAirports: () => {},
  };

  // Search field states (read-only for now)
  const originField: FlightSearchFieldState = {
    kind: "origin",
    value: originQuery,
    selectedAirport: originAirport,
    isActive: activeField === "origin",
    onChange: () => {},
    onSelect: () => {},
    onActivate: () => setActiveField("origin"),
    onBlur: () => setActiveField(null),
  };

  const destinationField: FlightSearchFieldState = {
    kind: "destination",
    value: destinationQuery,
    selectedAirport: destinationAirport,
    isActive: activeField === "destination",
    onChange: () => {},
    onSelect: () => {},
    onActivate: () => setActiveField("destination"),
    onBlur: () => setActiveField(null),
  };

  const searchState: FlightExplorerSearchState = {
    airports,
    origin: originField,
    destination: destinationField,
    showDestinationField: true,
    isEditing: activeField !== null,
    shouldShowSearchAction: true,
    isSearchDisabled: flightsDatesMutation.isLoading,
    isSearching: flightsDatesMutation.isLoading,
    onSearch: performSearch,
    onReset: () => {
      setFlightPrices([]);
      setSelectedDate(null);
      setSelectedPriceIndex(null);
      setFlightOptions([]);
      setSearchError(null);
    },
    selectRoute: () => {},
    clearRoute: () => {},
    routeChangedSinceSearch: false,
  };

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

  // Price state
  const priceState: FlightExplorerPriceState = {
    shouldShowPanel: true,
    chartData,
    cheapestEntry,
    searchError,
    isSearching: flightsDatesMutation.isLoading,
    searchWindowDays: filters.searchWindowDays,
    selectedDate,
    selectedPriceIndex,
    flightOptions,
    isFlightOptionsLoading,
    flightOptionsError,
    onSelectPriceIndex: (index) => {
      if (index < 0 || index >= flightPrices.length) {
        setSelectedDate(null);
        setSelectedPriceIndex(null);
        return;
      }
      const entry = flightPrices[index];
      setSelectedPriceIndex(index);
      setSelectedDate(entry.date);
      void loadFlightOptions(entry.date);
    },
    onSelectDate: (isoDate) => {
      if (!isoDate) {
        setSelectedDate(null);
        setSelectedPriceIndex(null);
        return;
      }
      const normalized = format(startOfDay(parseISO(isoDate)), "yyyy-MM-dd");
      setSelectedDate(normalized);
      const index = flightPrices.findIndex(
        (entry) => entry.date === normalized,
      );
      setSelectedPriceIndex(index >= 0 ? index : null);
      void loadFlightOptions(normalized);
    },
    canRefetch: false,
    onRefetch: performSearch,
  };

  return (
    <div className="flex flex-col h-full">
      <RouteSearchPanel search={searchState} header={headerState} />
      <div
        id="flight-price-panel-scroll"
        className="flex-1 overflow-auto bg-muted/10"
      >
        <div className="container mx-auto flex flex-col gap-4 p-4">
          <FlightFiltersPanel
            filters={filtersState}
            price={{
              isSearching: flightsDatesMutation.isLoading,
              canRefetch: false,
              onRefetch: performSearch,
            }}
          />
          <FlightPricePanel
            state={priceState}
            filters={filtersState}
            originAirport={originAirport}
            destinationAirport={destinationAirport}
            airports={airports}
          />
        </div>
      </div>
    </div>
  );
}
