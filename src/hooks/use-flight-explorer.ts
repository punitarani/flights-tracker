"use client";

import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfToday,
} from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_SEARCH_WINDOW_DAYS,
  type FlightPricePoint,
  SEARCH_WINDOW_OPTIONS,
} from "@/components/flight-explorer/constants";
import { MaxStops, SeatType, TripType } from "@/lib/fli/models";
import { type MapKitMap, mapKitLoader } from "@/lib/mapkit-service";
import { trpc } from "@/lib/trpc/react";
import type { AirportData } from "@/server/services/airports";
import type { FlightOption } from "@/server/services/flights";

type ViewMode = "browse" | "search";

export type TimeRangeValue = {
  from: number;
  to: number;
};

export const DEFAULT_TIME_RANGE: TimeRangeValue = {
  from: 0,
  to: 24,
};

const NEARLY_MIDNIGHT_THRESHOLD = 23.9834;
const NEARLY_ZERO_THRESHOLD = 0.0167;

function clampTimeValue(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 0;
  }

  if (value >= NEARLY_MIDNIGHT_THRESHOLD) {
    return 24;
  }

  if (value <= NEARLY_ZERO_THRESHOLD) {
    return 0;
  }

  if (value > 24) {
    return 24;
  }

  if (value < 0) {
    return 0;
  }

  return Math.round(value);
}

function ensureTimeRange(range: TimeRangeValue | null): TimeRangeValue {
  if (!range) {
    return { ...DEFAULT_TIME_RANGE };
  }

  let from = clampTimeValue(range.from);
  let to = clampTimeValue(range.to);

  if (from > to) {
    [from, to] = [to, from];
  }

  return { from, to };
}

export function isFullDayTimeRange(
  range: TimeRangeValue | null | undefined,
): boolean {
  if (!range) {
    return true;
  }

  const sanitized = ensureTimeRange(range ?? null);
  return (
    sanitized.from === DEFAULT_TIME_RANGE.from &&
    sanitized.to === DEFAULT_TIME_RANGE.to
  );
}

const FETCH_DEBOUNCE_MS = 350;
const MOVEMENT_THRESHOLD_DEGREES = 0.05;
const FLIGHT_OPTIONS_DEBOUNCE_MS = 2000;
const DEFAULT_PASSENGERS = {
  adults: 1,
  children: 0,
  infantsInSeat: 0,
  infantsOnLap: 0,
} as const;

const SEARCH_WINDOW_SET = new Set<number>(SEARCH_WINDOW_OPTIONS);

type SearchWindowOption = (typeof SEARCH_WINDOW_OPTIONS)[number];

function clampToAllowedWindow(days: number): SearchWindowOption {
  if (SEARCH_WINDOW_SET.has(days)) {
    return days as SearchWindowOption;
  }
  const sorted = SEARCH_WINDOW_OPTIONS;
  return sorted.reduce<SearchWindowOption>((closest, option) => {
    const diff = Math.abs(option - days);
    const bestDiff = Math.abs(closest - days);
    if (diff < bestDiff) {
      return option;
    }
    return closest;
  }, sorted[0]);
}

function computeDateRange(from: Date, windowDays: number) {
  const clamped = clampToAllowedWindow(windowDays);
  const normalizedFrom = startOfDay(from);
  return {
    from: normalizedFrom,
    to: addDays(normalizedFrom, clamped - 1),
    windowDays: clamped,
  } as const;
}

function resolveWindowFromRange(range: { from: Date; to: Date }): number {
  const diff = differenceInCalendarDays(range.to, range.from) + 1;
  return clampToAllowedWindow(diff);
}

function createDefaultFilters(): FiltersState {
  const today = startOfToday();
  const from = addDays(today, 1);
  const {
    from: normalizedFrom,
    to,
    windowDays,
  } = computeDateRange(from, DEFAULT_SEARCH_WINDOW_DAYS);
  return {
    dateRange: { from: normalizedFrom, to },
    departureTimeRange: { ...DEFAULT_TIME_RANGE },
    arrivalTimeRange: { ...DEFAULT_TIME_RANGE },
    airlines: [],
    seatType: SeatType.ECONOMY,
    stops: MaxStops.ANY,
    searchWindowDays: windowDays,
  };
}

function formatIsoDate(date: Date): string {
  return format(startOfDay(date), "yyyy-MM-dd");
}

function normalizeTimeRange(
  range: TimeRangeValue | null,
): Partial<TimeRangeValue> | undefined {
  const sanitized = ensureTimeRange(range);
  if (isFullDayTimeRange(sanitized)) {
    return undefined;
  }

  const normalized: Partial<TimeRangeValue> = {};

  if (sanitized.from !== DEFAULT_TIME_RANGE.from) {
    normalized.from = sanitized.from;
  }

  if (sanitized.to !== DEFAULT_TIME_RANGE.to) {
    normalized.to = sanitized.to;
  }

  if (normalized.from === undefined && normalized.to === undefined) {
    return undefined;
  }

  return normalized;
}

export type FlightSearchFieldState = {
  kind: "origin" | "destination";
  value: string;
  selectedAirport: AirportData | null;
  isActive: boolean;
  onChange: (value: string) => void;
  onSelect: (airport: AirportData | null) => void;
  onActivate: () => void;
  onBlur: () => void;
};

export type FlightExplorerSearchState = {
  airports: AirportData[];
  origin: FlightSearchFieldState;
  destination: FlightSearchFieldState;
  showDestinationField: boolean;
  isEditing: boolean;
  shouldShowSearchAction: boolean;
  isSearchDisabled: boolean;
  isSearching: boolean;
  onSearch: () => void;
  routeChangedSinceSearch: boolean;
};

export type FlightExplorerHeaderState = {
  displayMessage: string;
  isInitialLoading: boolean;
  isLoadingNearby: boolean;
  totalAirports: number;
  onShowAllAirports: () => void;
};

export type FlightExplorerMapState = {
  displayedAirports: AirportData[];
  originAirport: AirportData | null;
  destinationAirport: AirportData | null;
  showAllAirports: boolean;
  onMapReady: (map: MapKitMap) => void;
  onAirportClick: (airport: AirportData) => void;
};

export type FlightPriceChartPoint = FlightPricePoint & {
  formattedDate: string;
};

export type FlightExplorerPriceState = {
  shouldShowPanel: boolean;
  chartData: FlightPriceChartPoint[];
  cheapestEntry: FlightPricePoint | null;
  searchError: string | null;
  isSearching: boolean;
  hasSearched: boolean;
  searchWindowDays: number;
  selectedDate: string | null;
  selectedPriceIndex: number | null;
  flightOptions: FlightOption[];
  isFlightOptionsLoading: boolean;
  flightOptionsError: string | null;
  onSelectPriceIndex: (index: number) => void;
  onSelectDate: (isoDate: string | null) => void;
  canRefetch: boolean;
  onRefetch: () => void;
};

type FiltersState = {
  dateRange: { from: Date; to: Date };
  departureTimeRange: TimeRangeValue;
  arrivalTimeRange: TimeRangeValue;
  airlines: string[];
  seatType: SeatType;
  stops: MaxStops;
  searchWindowDays: number;
};

export type FlightExplorerFiltersState = {
  dateRange: FiltersState["dateRange"];
  departureTimeRange: FiltersState["departureTimeRange"];
  arrivalTimeRange: FiltersState["arrivalTimeRange"];
  airlines: string[];
  seatType: SeatType;
  stops: MaxStops;
  searchWindowDays: number;
  hasCustomFilters: boolean;
  hasPendingChanges: boolean;
  onDateRangeChange: (range: { from: Date; to: Date }) => void;
  onDepartureTimeRangeChange: (range: TimeRangeValue | null) => void;
  onArrivalTimeRangeChange: (range: TimeRangeValue | null) => void;
  onAirlinesChange: (codes: string[]) => void;
  onSeatTypeChange: (seatType: SeatType) => void;
  onStopsChange: (stops: MaxStops) => void;
  onSearchWindowDaysChange: (days: number) => void;
  onReset: () => void;
};

type FlightFiltersPayload = {
  tripType: TripType;
  segments: Array<{
    origin: string;
    destination: string;
    departureDate: string;
    departureTimeRange?: { from?: number; to?: number };
    arrivalTimeRange?: { from?: number; to?: number };
  }>;
  passengers: {
    adults: number;
    children: number;
    infantsInSeat: number;
    infantsOnLap: number;
  };
  seatType: SeatType;
  stops: MaxStops;
  dateRange: { from: string; to: string };
  airlines?: string[];
};

type FlightSearchOverrides = {
  departureDate?: string;
  dateRange?: { from: string; to: string };
};

export type UseFlightExplorerOptions = {
  airports: AirportData[];
  totalAirports: number;
  isInitialLoading: boolean;
};

export type UseFlightExplorerResult = {
  search: FlightExplorerSearchState;
  header: FlightExplorerHeaderState;
  map: FlightExplorerMapState;
  price: FlightExplorerPriceState;
  filters: FlightExplorerFiltersState;
};

export function useFlightExplorer({
  airports,
  totalAirports,
  isInitialLoading,
}: UseFlightExplorerOptions): UseFlightExplorerResult {
  const [nearbyAirports, setNearbyAirports] = useState<AirportData[]>([]);
  const [originQuery, setOriginQuery] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [originAirport, setOriginAirport] = useState<AirportData | null>(null);
  const [destinationAirport, setDestinationAirport] =
    useState<AirportData | null>(null);
  const [activeField, setActiveField] = useState<
    "origin" | "destination" | null
  >("origin");
  const [viewMode, setViewMode] = useState<ViewMode>("browse");
  const [mapCenter, setMapCenter] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [lastValidRoute, setLastValidRoute] = useState<{
    origin: AirportData;
    destination: AirportData;
  } | null>(null);
  const [showAllAirports, setShowAllAirports] = useState(true);
  const [flightPrices, setFlightPrices] = useState<FlightPricePoint[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [filters, setFilters] = useState<FiltersState>(() =>
    createDefaultFilters(),
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedPriceIndex, setSelectedPriceIndex] = useState<number | null>(
    null,
  );
  const [flightOptions, setFlightOptions] = useState<FlightOption[]>([]);
  const [isFlightOptionsLoading, setIsFlightOptionsLoading] = useState(false);
  const [flightOptionsError, setFlightOptionsError] = useState<string | null>(
    null,
  );
  const [hasPendingFilterChanges, setHasPendingFilterChanges] = useState(false);
  const [lastSearchRoute, setLastSearchRoute] = useState<{
    originId: string;
    destinationId: string;
  } | null>(null);
  const [routeChangedSinceSearch, setRouteChangedSinceSearch] = useState(false);

  const viewModeRef = useRef<ViewMode>("browse");
  const pendingFetchTimeoutRef = useRef<number | null>(null);
  const lastFetchRef = useRef<{ lat: number; lon: number } | null>(null);
  const mapInstanceRef = useRef<MapKitMap | null>(null);
  const latestNearbyRequestRef = useRef(0);
  const latestSearchRequestRef = useRef(0);
  const latestFlightOptionsRequestRef = useRef(0);
  const flightOptionsDebounceRef = useRef<number | null>(null);
  const trpcContext = trpc.useContext();
  const flightsDatesMutation = trpc.useMutation(["flights.dates"]);
  const flightsSearchMutation = trpc.useMutation(["flights.search"]);

  const clearFlightOptionsDebounce = useCallback(() => {
    if (flightOptionsDebounceRef.current !== null) {
      window.clearTimeout(flightOptionsDebounceRef.current);
      flightOptionsDebounceRef.current = null;
    }
  }, []);

  const clearSelectedDateAndOptions = useCallback(() => {
    latestFlightOptionsRequestRef.current += 1;
    clearFlightOptionsDebounce();
    setSelectedDate(null);
    setSelectedPriceIndex(null);
    setFlightOptions([]);
    setFlightOptionsError(null);
    setIsFlightOptionsLoading(false);
  }, [clearFlightOptionsDebounce]);

  const markFiltersDirty = useCallback(() => {
    clearSelectedDateAndOptions();
    setHasPendingFilterChanges(true);
  }, [clearSelectedDateAndOptions]);

  useEffect(() => {
    if (!selectedDate) {
      return;
    }

    const parsed = parseISO(selectedDate);
    const isInside = isWithinInterval(parsed, {
      start: filters.dateRange.from,
      end: filters.dateRange.to,
    });

    if (!isInside) {
      clearSelectedDateAndOptions();
    }
  }, [clearSelectedDateAndOptions, filters.dateRange, selectedDate]);

  const displayedAirports = useMemo(() => {
    if (showAllAirports) {
      return airports;
    }

    if (originAirport && destinationAirport) {
      return [originAirport, destinationAirport];
    }

    if (originAirport) {
      return [originAirport];
    }

    return nearbyAirports;
  }, [
    airports,
    destinationAirport,
    originAirport,
    nearbyAirports,
    showAllAirports,
  ]);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    if (originAirport && destinationAirport) {
      setLastValidRoute((previous) => {
        if (
          previous &&
          previous.origin.id === originAirport.id &&
          previous.destination.id === destinationAirport.id
        ) {
          return previous;
        }

        return {
          origin: originAirport,
          destination: destinationAirport,
        };
      });
    }
  }, [destinationAirport, originAirport]);

  useEffect(() => {
    if (!hasSearched || !lastSearchRoute) {
      setRouteChangedSinceSearch(false);
      return;
    }

    if (originAirport && destinationAirport) {
      const changed =
        originAirport.id !== lastSearchRoute.originId ||
        destinationAirport.id !== lastSearchRoute.destinationId;
      setRouteChangedSinceSearch(changed);
    } else {
      setRouteChangedSinceSearch(false);
    }
  }, [destinationAirport, hasSearched, lastSearchRoute, originAirport]);

  useEffect(() => {
    if (
      !originAirport &&
      !destinationAirport &&
      !originQuery.trim() &&
      !destinationQuery.trim()
    ) {
      setLastValidRoute(null);
    }
  }, [destinationAirport, destinationQuery, originAirport, originQuery]);

  const clearPendingFetch = useCallback(() => {
    if (pendingFetchTimeoutRef.current !== null) {
      window.clearTimeout(pendingFetchTimeoutRef.current);
      pendingFetchTimeoutRef.current = null;
    }
  }, []);

  const fetchNearbyAirports = useCallback(
    async (lat: number, lon: number, options: { force?: boolean } = {}) => {
      if (viewModeRef.current === "search" && !options.force) {
        return;
      }

      const lastFetch = lastFetchRef.current;
      if (
        !options.force &&
        lastFetch &&
        Math.abs(lastFetch.lat - lat) < MOVEMENT_THRESHOLD_DEGREES &&
        Math.abs(lastFetch.lon - lon) < MOVEMENT_THRESHOLD_DEGREES
      ) {
        return;
      }

      lastFetchRef.current = { lat, lon };
      const requestId = latestNearbyRequestRef.current + 1;
      latestNearbyRequestRef.current = requestId;

      try {
        setIsLoadingNearby(true);
        const data = await trpcContext.fetchQuery([
          "airports.search",
          {
            lat,
            lon,
            radius: 100,
            limit: 1000,
          },
        ]);

        if (latestNearbyRequestRef.current !== requestId) {
          return;
        }

        if (options.force || viewModeRef.current === "browse") {
          setNearbyAirports(data.airports);
        }
      } catch (error) {
        if (latestNearbyRequestRef.current === requestId) {
          console.error("Failed to fetch nearby airports:", error);
        }
      } finally {
        if (latestNearbyRequestRef.current === requestId) {
          setIsLoadingNearby(false);
        }
      }
    },
    [trpcContext],
  );

  const scheduleNearbyFetch = useCallback(
    (
      lat: number,
      lon: number,
      options: { force?: boolean; immediate?: boolean } = {},
    ) => {
      if (options.immediate) {
        clearPendingFetch();
        void fetchNearbyAirports(lat, lon, options);
        return;
      }

      clearPendingFetch();
      pendingFetchTimeoutRef.current = window.setTimeout(() => {
        pendingFetchTimeoutRef.current = null;
        void fetchNearbyAirports(lat, lon, options);
      }, FETCH_DEBOUNCE_MS);
    },
    [clearPendingFetch, fetchNearbyAirports],
  );

  useEffect(() => {
    return () => {
      clearPendingFetch();
    };
  }, [clearPendingFetch]);

  useEffect(() => {
    return () => {
      clearFlightOptionsDebounce();
    };
  }, [clearFlightOptionsDebounce]);

  const resetToBrowse = useCallback(() => {
    setViewMode("browse");
    viewModeRef.current = "browse";
    setShowAllAirports(false);
    clearPendingFetch();
    latestSearchRequestRef.current += 1;
    setFlightPrices([]);
    setSearchError(null);
    setHasSearched(false);
    setHasPendingFilterChanges(false);
    setLastSearchRoute(null);
    setRouteChangedSinceSearch(false);

    if (mapCenter) {
      scheduleNearbyFetch(mapCenter.lat, mapCenter.lon, {
        force: true,
        immediate: true,
      });
    }
  }, [clearPendingFetch, mapCenter, scheduleNearbyFetch]);

  const formatAirportValue = useCallback(
    (airport: AirportData) => `${airport.name} (${airport.iata})`,
    [],
  );

  const handleOriginChange = useCallback(
    (value: string) => {
      setOriginQuery(value);
      setActiveField("origin");

      if (value.trim()) {
        setShowAllAirports(false);
      }

      if (
        originAirport &&
        value.trim() &&
        value !== formatAirportValue(originAirport)
      ) {
        setOriginAirport(null);
        setDestinationAirport(null);
        setDestinationQuery("");
      }

      if (!value.trim()) {
        setOriginAirport(null);
        setDestinationAirport(null);
        setDestinationQuery("");
        resetToBrowse();
        return;
      }

      setViewMode("search");
    },
    [formatAirportValue, originAirport, resetToBrowse],
  );

  const handleDestinationChange = useCallback(
    (value: string) => {
      setDestinationQuery(value);
      setActiveField("destination");

      if (value.trim()) {
        setShowAllAirports(false);
      }

      if (
        destinationAirport &&
        value.trim() &&
        value !== formatAirportValue(destinationAirport)
      ) {
        setDestinationAirport(null);
      }

      if (!value.trim()) {
        setDestinationAirport(null);
      } else {
        setViewMode("search");
      }
    },
    [destinationAirport, formatAirportValue],
  );

  const handleOriginSelect = useCallback(
    (airport: AirportData | null) => {
      if (!airport) {
        setOriginAirport(null);
        setOriginQuery("");
        setDestinationAirport(null);
        setDestinationQuery("");
        setActiveField("origin");
        setViewMode("browse");
        resetToBrowse();
        setLastValidRoute(null);
        return;
      }

      setOriginAirport(airport);
      setShowAllAirports(false);
      setOriginQuery(formatAirportValue(airport));
      const matchesDestination =
        destinationAirport && destinationAirport.id === airport.id;

      if (matchesDestination) {
        setDestinationAirport(null);
        setDestinationQuery("");
      }

      const shouldPromptDestination = !destinationAirport || matchesDestination;

      setActiveField(shouldPromptDestination ? "destination" : null);
      setViewMode(shouldPromptDestination ? "search" : "browse");
    },
    [destinationAirport, formatAirportValue, resetToBrowse],
  );

  const handleDestinationSelect = useCallback(
    (airport: AirportData | null) => {
      if (!airport) {
        setDestinationAirport(null);
        setDestinationQuery("");
        setActiveField("destination");
        setViewMode("search");
        return;
      }

      if (originAirport && airport.id === originAirport.id) {
        setDestinationAirport(null);
        setDestinationQuery("");
        setActiveField("destination");
        setViewMode("search");
        return;
      }

      setDestinationAirport(airport);
      setShowAllAirports(false);
      setDestinationQuery(formatAirportValue(airport));
      setActiveField(null);
      setViewMode("browse");
      if (originAirport) {
        setLastValidRoute({ origin: originAirport, destination: airport });
      }
    },
    [formatAirportValue, originAirport],
  );

  const handleMapReady = useCallback(
    // biome-ignore lint/suspicious/noExplicitAny: MapKit types are loaded at runtime
    (map: any) => {
      mapInstanceRef.current = map;
      const center = map.center;
      setMapCenter({ lat: center.latitude, lon: center.longitude });

      scheduleNearbyFetch(center.latitude, center.longitude, {
        force: true,
        immediate: true,
      });

      map.addEventListener("region-change-start", () => {
        clearPendingFetch();
      });

      map.addEventListener("region-change-end", () => {
        const newCenter = map.center;
        setMapCenter({ lat: newCenter.latitude, lon: newCenter.longitude });

        if (viewModeRef.current === "browse") {
          scheduleNearbyFetch(newCenter.latitude, newCenter.longitude);
        }
      });
    },
    [scheduleNearbyFetch, clearPendingFetch],
  );

  const handleAirportClick = useCallback(
    (airport: AirportData) => {
      setShowAllAirports(false);

      if (activeField === "origin") {
        handleOriginSelect(airport);
        return;
      }

      if (!originAirport) {
        handleOriginSelect(airport);
        return;
      }

      if (airport.id === originAirport.id) {
        handleDestinationSelect(null);
        return;
      }

      handleDestinationSelect(airport);
    },
    [activeField, handleDestinationSelect, handleOriginSelect, originAirport],
  );

  const handleDateRangeChange = useCallback(
    (range: { from: Date; to: Date }) => {
      if (!range.from || !range.to) {
        return;
      }

      const normalizedFrom = startOfDay(range.from);
      const normalizedTo = startOfDay(range.to);
      const windowDays = resolveWindowFromRange({
        from: normalizedFrom,
        to: normalizedTo,
      });
      const { to } = computeDateRange(normalizedFrom, windowDays);

      setFilters((previous) => ({
        ...previous,
        dateRange: {
          from: normalizedFrom,
          to,
        },
        searchWindowDays: windowDays,
      }));
      markFiltersDirty();
    },
    [markFiltersDirty],
  );

  const handleDepartureTimeRangeChange = useCallback(
    (range: TimeRangeValue | null) => {
      const nextRange = ensureTimeRange(range);
      let changed = false;
      setFilters((previous) => {
        if (
          previous.departureTimeRange.from === nextRange.from &&
          previous.departureTimeRange.to === nextRange.to
        ) {
          return previous;
        }

        changed = true;
        return {
          ...previous,
          departureTimeRange: nextRange,
        };
      });

      if (changed) {
        markFiltersDirty();
      }
    },
    [markFiltersDirty],
  );

  const handleArrivalTimeRangeChange = useCallback(
    (range: TimeRangeValue | null) => {
      const nextRange = ensureTimeRange(range);
      let changed = false;
      setFilters((previous) => {
        if (
          previous.arrivalTimeRange.from === nextRange.from &&
          previous.arrivalTimeRange.to === nextRange.to
        ) {
          return previous;
        }

        changed = true;
        return {
          ...previous,
          arrivalTimeRange: nextRange,
        };
      });

      if (changed) {
        markFiltersDirty();
      }
    },
    [markFiltersDirty],
  );

  const handleAirlinesChange = useCallback(
    (codes: string[]) => {
      setFilters((previous) => ({
        ...previous,
        airlines: Array.from(
          new Set(
            codes
              .map((code) => code.trim().toUpperCase())
              .filter((code) => code.length > 0),
          ),
        ),
      }));
      markFiltersDirty();
    },
    [markFiltersDirty],
  );

  const handleSeatTypeChange = useCallback(
    (seatType: SeatType) => {
      setFilters((previous) => ({
        ...previous,
        seatType,
      }));
      markFiltersDirty();
    },
    [markFiltersDirty],
  );

  const handleStopsChange = useCallback(
    (stops: MaxStops) => {
      setFilters((previous) => ({
        ...previous,
        stops,
      }));
      markFiltersDirty();
    },
    [markFiltersDirty],
  );

  const handleSearchWindowDaysChange = useCallback(
    (days: number) => {
      const clamped = clampToAllowedWindow(days);
      setFilters((previous) => {
        const { from } = previous.dateRange;
        const { from: normalizedFrom, to } = computeDateRange(from, clamped);
        return {
          ...previous,
          dateRange: {
            from: normalizedFrom,
            to,
          },
          searchWindowDays: clamped,
        };
      });
      markFiltersDirty();
    },
    [markFiltersDirty],
  );

  const handleResetFilters = useCallback(() => {
    clearSelectedDateAndOptions();
    setFilters(createDefaultFilters());
    markFiltersDirty();
  }, [clearSelectedDateAndOptions, markFiltersDirty]);

  const buildFiltersPayload = useCallback(
    (
      route: {
        origin: AirportData;
        destination: AirportData;
      },
      overrides?: FlightSearchOverrides,
    ): FlightFiltersPayload => {
      const defaultFromIso = formatIsoDate(filters.dateRange.from);
      const defaultToIso = formatIsoDate(filters.dateRange.to);

      const effectiveDateRange = overrides?.dateRange ?? {
        from: defaultFromIso,
        to: defaultToIso,
      };

      const segmentDeparture =
        overrides?.departureDate ?? effectiveDateRange.from;

      return {
        tripType: TripType.ONE_WAY,
        segments: [
          {
            origin: route.origin.iata,
            destination: route.destination.iata,
            departureDate: segmentDeparture,
            departureTimeRange: normalizeTimeRange(filters.departureTimeRange),
            arrivalTimeRange: normalizeTimeRange(filters.arrivalTimeRange),
          },
        ],
        passengers: { ...DEFAULT_PASSENGERS },
        seatType: filters.seatType,
        stops: filters.stops,
        dateRange: effectiveDateRange,
        airlines: filters.airlines.length > 0 ? filters.airlines : undefined,
      };
    },
    [filters],
  );

  const displayMessage = useMemo(() => {
    if (isInitialLoading) return "Loading airports...";

    if (showAllAirports) {
      return `Showing all ${totalAirports.toLocaleString()} airports worldwide`;
    }

    if (isLoadingNearby && viewMode === "browse") {
      return "Loading nearby airports...";
    }

    if (originAirport && destinationAirport) {
      return `Route: ${originAirport.iata} → ${destinationAirport.iata}`;
    }

    if (originAirport) {
      return `Origin: ${originAirport.name} (${originAirport.iata})`;
    }

    if (viewMode === "browse") {
      return `Showing ${nearbyAirports.length} airports within 100 miles`;
    }

    if (activeField === "destination") {
      return destinationQuery
        ? "Select a destination airport"
        : "Choose a destination airport";
    }

    return "Find an origin airport";
  }, [
    activeField,
    destinationAirport,
    destinationQuery,
    isInitialLoading,
    isLoadingNearby,
    nearbyAirports.length,
    originAirport,
    showAllAirports,
    totalAirports,
    viewMode,
  ]);

  const normalizedOriginQuery = originQuery.trim();
  const normalizedDestinationQuery = destinationQuery.trim();
  const hasCurrentRoute = Boolean(originAirport && destinationAirport);
  const shouldShowSearchAction = hasCurrentRoute || Boolean(lastValidRoute);
  const isEditing = activeField !== null;

  const originMatchesSelection = Boolean(
    originAirport &&
      normalizedOriginQuery === formatAirportValue(originAirport),
  );

  const destinationMatchesSelection = Boolean(
    destinationAirport &&
      normalizedDestinationQuery === formatAirportValue(destinationAirport),
  );

  let isActiveFieldDirty = false;
  if (activeField === "origin") {
    isActiveFieldDirty =
      !normalizedOriginQuery || !originAirport || !originMatchesSelection;
  } else if (activeField === "destination") {
    isActiveFieldDirty =
      !normalizedDestinationQuery ||
      !destinationAirport ||
      !destinationMatchesSelection;
  }

  const hasSelectedRoute = hasCurrentRoute;
  const routeRequiresUpdateBeforeSearch =
    hasSearched && !routeChangedSinceSearch;
  const isSearching = flightsDatesMutation.isLoading;

  const isSearchDisabled =
    isSearching ||
    routeRequiresUpdateBeforeSearch ||
    !hasSelectedRoute ||
    (isEditing && isActiveFieldDirty);

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

  const shouldShowPricePanel =
    isSearching || searchError !== null || hasSearched;

  const hasCustomFilters = useMemo(() => {
    const defaults = createDefaultFilters();
    const defaultRange = defaults.dateRange;
    const isDefaultRange =
      isSameDay(filters.dateRange.from, defaultRange.from) &&
      isSameDay(filters.dateRange.to, defaultRange.to);
    const hasDefaultDeparture = isFullDayTimeRange(filters.departureTimeRange);
    const hasDefaultArrival = isFullDayTimeRange(filters.arrivalTimeRange);

    return (
      !isDefaultRange ||
      filters.airlines.length > 0 ||
      !hasDefaultDeparture ||
      !hasDefaultArrival ||
      filters.seatType !== defaults.seatType ||
      filters.stops !== defaults.stops ||
      filters.searchWindowDays !== defaults.searchWindowDays
    );
  }, [filters]);

  const canRefetch = hasSearched && hasPendingFilterChanges && !isSearching;

  const handleFieldBlur = useCallback(
    (field: "origin" | "destination") => {
      if (activeField !== field) {
        return;
      }

      const selectedAirport =
        field === "origin" ? originAirport : destinationAirport;

      if (!selectedAirport) {
        return;
      }

      const currentQuery =
        field === "origin" ? normalizedOriginQuery : normalizedDestinationQuery;

      if (currentQuery !== formatAirportValue(selectedAirport)) {
        return;
      }

      if (field === "origin") {
        if (destinationAirport) {
          setActiveField(null);
          setViewMode("browse");
        } else {
          setActiveField("destination");
          setViewMode("search");
        }
      } else if (originAirport && destinationAirport) {
        setActiveField(null);
        setViewMode("browse");
      }
    },
    [
      activeField,
      destinationAirport,
      formatAirportValue,
      normalizedDestinationQuery,
      normalizedOriginQuery,
      originAirport,
    ],
  );

  const performSearch = useCallback(
    async (options?: { preserveSelection?: boolean }) => {
      const preserveSelection = options?.preserveSelection ?? false;
      const route =
        originAirport && destinationAirport
          ? { origin: originAirport, destination: destinationAirport }
          : lastValidRoute;

      if (!route) {
        return;
      }

      setHasSearched(true);
      setSearchError(null);
      setHasPendingFilterChanges(false);

      if (!preserveSelection) {
        clearSelectedDateAndOptions();
      }

      const requestId = latestSearchRequestRef.current + 1;
      latestSearchRequestRef.current = requestId;

      try {
        const payload = buildFiltersPayload(route);
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
        setLastSearchRoute({
          originId: route.origin.id,
          destinationId: route.destination.id,
        });
        setRouteChangedSinceSearch(false);

        if (preserveSelection && selectedDate) {
          const index = sanitized.findIndex(
            (entry) => entry.date === selectedDate,
          );
          if (index >= 0) {
            setSelectedPriceIndex(index);
          } else {
            clearSelectedDateAndOptions();
          }
        }
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
        setHasPendingFilterChanges(true);
      }
    },
    [
      buildFiltersPayload,
      clearSelectedDateAndOptions,
      destinationAirport,
      flightsDatesMutation,
      lastValidRoute,
      originAirport,
      selectedDate,
    ],
  );

  const handleSearchClick = useCallback(() => {
    void performSearch();
  }, [performSearch]);

  const handleRefetch = useCallback(() => {
    if (!hasSearched || !hasPendingFilterChanges) {
      return;
    }

    void performSearch();
  }, [hasPendingFilterChanges, hasSearched, performSearch]);

  const loadFlightOptions = useCallback(
    async (isoDate: string) => {
      const route =
        originAirport && destinationAirport
          ? { origin: originAirport, destination: destinationAirport }
          : lastValidRoute;

      if (!route) {
        return;
      }

      const requestId = latestFlightOptionsRequestRef.current + 1;
      latestFlightOptionsRequestRef.current = requestId;
      setIsFlightOptionsLoading(true);
      setFlightOptionsError(null);
      setFlightOptions([]);

      try {
        const payload = buildFiltersPayload(route, {
          departureDate: isoDate,
          dateRange: { from: isoDate, to: isoDate },
        });
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
      buildFiltersPayload,
      destinationAirport,
      flightsSearchMutation,
      lastValidRoute,
      originAirport,
    ],
  );

  const scheduleFlightOptionsLoad = useCallback(
    (isoDate: string) => {
      clearFlightOptionsDebounce();
      latestFlightOptionsRequestRef.current += 1;
      setIsFlightOptionsLoading(true);
      setFlightOptionsError(null);
      setFlightOptions([]);
      flightOptionsDebounceRef.current = window.setTimeout(() => {
        flightOptionsDebounceRef.current = null;
        void loadFlightOptions(isoDate);
      }, FLIGHT_OPTIONS_DEBOUNCE_MS);
    },
    [clearFlightOptionsDebounce, loadFlightOptions],
  );

  const handleSelectPriceIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= flightPrices.length) {
        clearSelectedDateAndOptions();
        return;
      }

      const entry = flightPrices[index];
      setSelectedPriceIndex(index);
      setSelectedDate(entry.date);
      scheduleFlightOptionsLoad(entry.date);
    },
    [clearSelectedDateAndOptions, flightPrices, scheduleFlightOptionsLoad],
  );

  const handleSelectDate = useCallback(
    (isoDate: string | null) => {
      if (!isoDate) {
        clearSelectedDateAndOptions();
        return;
      }

      const normalized = formatIsoDate(parseISO(isoDate));
      setSelectedDate(normalized);
      const index = flightPrices.findIndex(
        (entry) => entry.date === normalized,
      );
      setSelectedPriceIndex(index >= 0 ? index : null);
      scheduleFlightOptionsLoad(normalized);
    },
    [clearSelectedDateAndOptions, flightPrices, scheduleFlightOptionsLoad],
  );

  const handleShowAllAirportsClick = useCallback(() => {
    setShowAllAirports(true);
    setViewMode("browse");
    viewModeRef.current = "browse";
    setActiveField(null);
    setOriginAirport(null);
    setDestinationAirport(null);
    setOriginQuery("");
    setDestinationQuery("");
    setLastValidRoute(null);
    clearPendingFetch();
    latestSearchRequestRef.current += 1;
    setFlightPrices([]);
    setSearchError(null);
    setHasSearched(false);
    setHasPendingFilterChanges(false);
    setLastSearchRoute(null);
    setRouteChangedSinceSearch(false);
    setIsLoadingNearby(false);

    if (mapInstanceRef.current) {
      try {
        const mapkit = mapKitLoader.getMapKit();
        const globalRegion = new mapkit.CoordinateRegion(
          new mapkit.Coordinate(20, 0),
          new mapkit.CoordinateSpan(160, 360),
        );
        mapInstanceRef.current.setRegionAnimated(globalRegion, true);
      } catch (error) {
        console.error("Failed to zoom out for all airports:", error);
      }
    }
  }, [clearPendingFetch]);

  const originField: FlightSearchFieldState = {
    kind: "origin",
    value: originQuery,
    selectedAirport: originAirport,
    isActive: activeField === "origin",
    onChange: handleOriginChange,
    onSelect: handleOriginSelect,
    onActivate: () => {
      setActiveField("origin");
      setViewMode("search");
    },
    onBlur: () => handleFieldBlur("origin"),
  };

  const destinationField: FlightSearchFieldState = {
    kind: "destination",
    value: destinationQuery,
    selectedAirport: destinationAirport,
    isActive: activeField === "destination",
    onChange: handleDestinationChange,
    onSelect: handleDestinationSelect,
    onActivate: () => {
      setActiveField("destination");
      setViewMode("search");
    },
    onBlur: () => handleFieldBlur("destination"),
  };

  const filtersState: FlightExplorerFiltersState = {
    dateRange: filters.dateRange,
    departureTimeRange: filters.departureTimeRange,
    arrivalTimeRange: filters.arrivalTimeRange,
    airlines: filters.airlines,
    seatType: filters.seatType,
    stops: filters.stops,
    searchWindowDays: filters.searchWindowDays,
    hasCustomFilters,
    hasPendingChanges: hasPendingFilterChanges,
    onDateRangeChange: handleDateRangeChange,
    onDepartureTimeRangeChange: handleDepartureTimeRangeChange,
    onArrivalTimeRangeChange: handleArrivalTimeRangeChange,
    onAirlinesChange: handleAirlinesChange,
    onSeatTypeChange: handleSeatTypeChange,
    onStopsChange: handleStopsChange,
    onSearchWindowDaysChange: handleSearchWindowDaysChange,
    onReset: handleResetFilters,
  };

  return {
    search: {
      airports,
      origin: originField,
      destination: destinationField,
      showDestinationField: Boolean(
        originAirport || activeField === "destination",
      ),
      isEditing,
      shouldShowSearchAction,
      isSearchDisabled,
      isSearching,
      onSearch: handleSearchClick,
      routeChangedSinceSearch,
    },
    header: {
      displayMessage,
      isInitialLoading,
      isLoadingNearby,
      totalAirports,
      onShowAllAirports: handleShowAllAirportsClick,
    },
    map: {
      displayedAirports,
      originAirport,
      destinationAirport,
      showAllAirports,
      onMapReady: handleMapReady,
      onAirportClick: handleAirportClick,
    },
    price: {
      shouldShowPanel: shouldShowPricePanel,
      chartData,
      cheapestEntry,
      searchError,
      isSearching,
      hasSearched,
      searchWindowDays: filters.searchWindowDays,
      selectedDate,
      selectedPriceIndex,
      flightOptions,
      isFlightOptionsLoading,
      flightOptionsError,
      onSelectPriceIndex: handleSelectPriceIndex,
      onSelectDate: handleSelectDate,
      canRefetch,
      onRefetch: handleRefetch,
    },
    filters: filtersState,
  };
}
