"use client";

import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  format,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfToday,
  subDays,
} from "date-fns";
import { usePathname, useRouter } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_SEARCH_WINDOW_DAYS,
  type FlightPricePoint,
  SEARCH_WINDOW_OPTIONS,
} from "@/components/flight-explorer/constants";
import {
  type FlightExplorerQueryState,
  flightExplorerQueryParsers,
} from "@/components/flight-explorer/query-state";
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
const SEARCH_STORAGE_KEY = "flightExplorer:lastSearch";

type StoredSearchFilters = {
  dateFrom: string;
  dateTo: string;
  searchWindowDays: number;
  departureTimeRange: { from: number; to: number };
  arrivalTimeRange: { from: number; to: number };
  seatType: SeatType;
  stops: MaxStops;
  airlines: string[];
  daysOfWeek: number[];
};

type StoredSearchState = {
  originId: string;
  destinationId: string;
  filters: StoredSearchFilters;
};

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
  const defaultStart = startOfDay(addWeeks(today, 1));
  const defaultEnd = startOfDay(subDays(addMonths(defaultStart, 1), 1));
  const windowDays = clampToAllowedWindow(
    differenceInCalendarDays(defaultEnd, defaultStart) + 1,
  );

  return {
    dateRange: { from: defaultStart, to: defaultEnd },
    departureTimeRange: { ...DEFAULT_TIME_RANGE },
    arrivalTimeRange: { ...DEFAULT_TIME_RANGE },
    airlines: [],
    daysOfWeek: [],
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

function arraysShallowEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a === b) {
    return true;
  }

  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }

  return true;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function sanitizeStoredTimeRange(value: unknown): TimeRangeValue {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_TIME_RANGE };
  }

  const candidate = value as { from?: unknown; to?: unknown };
  const from = isFiniteNumber(candidate.from)
    ? candidate.from
    : DEFAULT_TIME_RANGE.from;
  const to = isFiniteNumber(candidate.to)
    ? candidate.to
    : DEFAULT_TIME_RANGE.to;
  return ensureTimeRange({ from, to });
}

function sanitizeStoredAirlines(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().toUpperCase())
        .filter((item) => item.length > 0),
    ),
  );
}

function sanitizeStoredDaysOfWeek(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const validDays = value
    .map((item) => {
      if (typeof item === "number" && Number.isInteger(item)) {
        return item;
      }
      if (typeof item === "string" && item.trim().length > 0) {
        const parsed = Number.parseInt(item, 10);
        return Number.isNaN(parsed) ? null : parsed;
      }
      return null;
    })
    .filter((item): item is number => item !== null && item >= 0 && item <= 6);

  return Array.from(new Set(validDays)).sort((a, b) => a - b);
}

function isSeatTypeValue(value: unknown): value is SeatType {
  return Object.values(SeatType).includes(value as SeatType);
}

function isMaxStopsValue(value: unknown): value is MaxStops {
  return Object.values(MaxStops).includes(value as MaxStops);
}

function parseStoredSearchState(
  value: string | null | undefined,
): StoredSearchState | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<StoredSearchState> & {
      filters?: Partial<StoredSearchFilters>;
    };

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    if (typeof parsed.originId !== "string") {
      return null;
    }

    if (typeof parsed.destinationId !== "string") {
      return null;
    }

    const filters = parsed.filters;
    if (!filters || typeof filters !== "object") {
      return null;
    }

    if (
      typeof filters.dateFrom !== "string" ||
      typeof filters.dateTo !== "string"
    ) {
      return null;
    }

    const searchWindowDays = isFiniteNumber(filters.searchWindowDays)
      ? filters.searchWindowDays
      : DEFAULT_SEARCH_WINDOW_DAYS;

    const departureTimeRange = sanitizeStoredTimeRange(
      filters.departureTimeRange,
    );
    const arrivalTimeRange = sanitizeStoredTimeRange(filters.arrivalTimeRange);

    const seatType = isSeatTypeValue(filters.seatType)
      ? filters.seatType
      : SeatType.ECONOMY;

    const stops = isMaxStopsValue(filters.stops) ? filters.stops : MaxStops.ANY;

    const airlines = sanitizeStoredAirlines(filters.airlines);
    const daysOfWeek = sanitizeStoredDaysOfWeek(filters.daysOfWeek);

    return {
      originId: parsed.originId,
      destinationId: parsed.destinationId,
      filters: {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        searchWindowDays,
        departureTimeRange,
        arrivalTimeRange,
        seatType,
        stops,
        airlines,
        daysOfWeek,
      },
    } satisfies StoredSearchState;
  } catch {
    return null;
  }
}

function readStoredSearchState(): StoredSearchState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(SEARCH_STORAGE_KEY);
    return parseStoredSearchState(raw);
  } catch {
    return null;
  }
}

function writeStoredSearchState(state: StoredSearchState): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(SEARCH_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

function clearStoredSearchState(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(SEARCH_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

function parseQueryDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = parseISO(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return startOfDay(parsed);
  } catch {
    return null;
  }
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
  onReset: () => void;
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
  daysOfWeek: number[];
  seatType: SeatType;
  stops: MaxStops;
  searchWindowDays: number;
};

function buildSearchSignature(
  originId: string,
  destinationId: string,
  filters: FiltersState,
): string {
  return [
    originId,
    destinationId,
    formatIsoDate(filters.dateRange.from),
    formatIsoDate(filters.dateRange.to),
    String(filters.departureTimeRange.from),
    String(filters.departureTimeRange.to),
    String(filters.arrivalTimeRange.from),
    String(filters.arrivalTimeRange.to),
    filters.airlines.join(","),
    filters.daysOfWeek.join(","),
    String(filters.seatType),
    String(filters.stops),
    String(filters.searchWindowDays),
  ].join("|");
}

function areFiltersEqual(a: FiltersState, b: FiltersState): boolean {
  return (
    a.dateRange.from.getTime() === b.dateRange.from.getTime() &&
    a.dateRange.to.getTime() === b.dateRange.to.getTime() &&
    a.departureTimeRange.from === b.departureTimeRange.from &&
    a.departureTimeRange.to === b.departureTimeRange.to &&
    a.arrivalTimeRange.from === b.arrivalTimeRange.from &&
    a.arrivalTimeRange.to === b.arrivalTimeRange.to &&
    arraysShallowEqual(a.airlines, b.airlines) &&
    arraysShallowEqual(a.daysOfWeek, b.daysOfWeek) &&
    a.seatType === b.seatType &&
    a.stops === b.stops &&
    a.searchWindowDays === b.searchWindowDays
  );
}

function cloneFilters(source: FiltersState): FiltersState {
  return {
    dateRange: {
      from: new Date(source.dateRange.from.getTime()),
      to: new Date(source.dateRange.to.getTime()),
    },
    departureTimeRange: { ...ensureTimeRange(source.departureTimeRange) },
    arrivalTimeRange: { ...ensureTimeRange(source.arrivalTimeRange) },
    airlines: [...source.airlines],
    daysOfWeek: [...source.daysOfWeek],
    seatType: source.seatType,
    stops: source.stops,
    searchWindowDays: source.searchWindowDays,
  };
}

function filtersFromStoredState(
  stored: StoredSearchState,
  defaults: FiltersState,
): FiltersState {
  const parsedFrom =
    parseQueryDate(stored.filters.dateFrom) ?? defaults.dateRange.from;

  const requestedWindow = stored.filters.searchWindowDays;
  const windowDays = clampToAllowedWindow(
    typeof requestedWindow === "number"
      ? requestedWindow
      : defaults.searchWindowDays,
  );
  const computedRange = computeDateRange(parsedFrom, windowDays);

  const departureRange = ensureTimeRange(stored.filters.departureTimeRange);
  const arrivalRange = ensureTimeRange(stored.filters.arrivalTimeRange);

  const normalizedAirlines = Array.from(
    new Set(
      stored.filters.airlines
        .map((code) => code.trim().toUpperCase())
        .filter((code) => code.length > 0),
    ),
  );

  return {
    dateRange: {
      from: computedRange.from,
      to: computedRange.to,
    },
    departureTimeRange: departureRange,
    arrivalTimeRange: arrivalRange,
    airlines: normalizedAirlines,
    daysOfWeek: sanitizeStoredDaysOfWeek(stored.filters.daysOfWeek),
    seatType: stored.filters.seatType,
    stops: stored.filters.stops,
    searchWindowDays: computedRange.windowDays,
  };
}

function buildStoredSearchState(
  originId: string,
  destinationId: string,
  filters: FiltersState,
): StoredSearchState {
  const departureRange = ensureTimeRange(filters.departureTimeRange);
  const arrivalRange = ensureTimeRange(filters.arrivalTimeRange);

  return {
    originId,
    destinationId,
    filters: {
      dateFrom: formatIsoDate(filters.dateRange.from),
      dateTo: formatIsoDate(filters.dateRange.to),
      searchWindowDays: filters.searchWindowDays,
      departureTimeRange: { ...departureRange },
      arrivalTimeRange: { ...arrivalRange },
      seatType: filters.seatType,
      stops: filters.stops,
      airlines: [...filters.airlines],
      daysOfWeek: [...filters.daysOfWeek],
    },
  };
}

export type FlightExplorerFiltersState = {
  dateRange: FiltersState["dateRange"];
  departureTimeRange: FiltersState["departureTimeRange"];
  arrivalTimeRange: FiltersState["arrivalTimeRange"];
  airlines: string[];
  daysOfWeek: number[];
  seatType: SeatType;
  stops: MaxStops;
  searchWindowDays: number;
  hasCustomFilters: boolean;
  hasPendingChanges: boolean;
  onDateRangeChange: (range: { from: Date; to: Date }) => void;
  onDepartureTimeRangeChange: (range: TimeRangeValue | null) => void;
  onArrivalTimeRangeChange: (range: TimeRangeValue | null) => void;
  onAirlinesChange: (codes: string[]) => void;
  onDaysOfWeekChange: (days: number[]) => void;
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
  dateRange: { from: string; to: string };
  seatType?: SeatType;
  stops?: MaxStops;
  airlines?: string[];
  daysOfWeek?: number[];
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

type FlightExplorerQueryUpdates = Partial<{
  [Key in keyof FlightExplorerQueryState]: FlightExplorerQueryState[Key] | null;
}>;

export function useFlightExplorer({
  airports,
  totalAirports,
  isInitialLoading,
}: UseFlightExplorerOptions): UseFlightExplorerResult {
  const router = useRouter();
  const pathname = usePathname();
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
  const [filters, setFilters] = useState<FiltersState>(() =>
    createDefaultFilters(),
  );
  const [committedFilters, setCommittedFilters] = useState<FiltersState>(() =>
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
  const [_initialSearchToken, setInitialSearchToken] = useState(0);

  const [queryState, setQueryState] = useQueryStates(
    flightExplorerQueryParsers,
    {
      history: "replace",
      shallow: true,
    },
  );

  const suppressQueryUpdatesRef = useRef(false);
  const pendingInitialSearchRef = useRef(false);
  const didHydrateFromQueryRef = useRef(false);
  const lastHydratedOriginIdRef = useRef<string | null>(null);
  const lastHydratedDestinationIdRef = useRef<string | null>(null);
  const lastPendingSearchSignatureRef = useRef<string | null>(null);

  const updateQueryState = useCallback(
    (updates: FlightExplorerQueryUpdates) => {
      if (suppressQueryUpdatesRef.current) {
        return;
      }
      void setQueryState(updates, { history: "replace", shallow: true });
    },
    [setQueryState],
  );

  const setShowAllAirportsPersisted = useCallback((value: boolean) => {
    setShowAllAirports(value);
  }, []);

  const viewModeRef = useRef<ViewMode>("browse");
  const pendingFetchTimeoutRef = useRef<number | null>(null);
  const lastFetchRef = useRef<{ lat: number; lon: number } | null>(null);
  const mapInstanceRef = useRef<MapKitMap | null>(null);
  const latestNearbyRequestRef = useRef(0);
  const latestSearchRequestRef = useRef(0);
  const latestFlightOptionsRequestRef = useRef(0);
  const trpcContext = trpc.useContext();
  const flightsDatesMutation = trpc.useMutation(["flights.dates"]);
  const flightsSearchMutation = trpc.useMutation(["flights.search"]);

  const clearSelectedDateAndOptions = useCallback(() => {
    latestFlightOptionsRequestRef.current += 1;
    setSelectedDate(null);
    setSelectedPriceIndex(null);
    setFlightOptions([]);
    setFlightOptionsError(null);
    setIsFlightOptionsLoading(false);
  }, []);

  const markFiltersDirty = useCallback(() => {
    setHasPendingFilterChanges(true);
  }, []);

  useEffect(() => {
    const next = !areFiltersEqual(filters, committedFilters);
    setHasPendingFilterChanges((previous) =>
      previous === next ? previous : next,
    );
  }, [committedFilters, filters]);

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
    if (
      !originAirport &&
      !destinationAirport &&
      !originQuery.trim() &&
      !destinationQuery.trim()
    ) {
      setLastValidRoute(null);
    }
  }, [destinationAirport, destinationQuery, originAirport, originQuery]);

  useEffect(() => {
    if (!lastSearchRoute) {
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
  }, [destinationAirport, lastSearchRoute, originAirport]);

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

  const resetToBrowse = useCallback(
    (options?: { shouldNavigate?: boolean }) => {
      const shouldNavigate = options?.shouldNavigate ?? true;

      setViewMode("browse");
      viewModeRef.current = "browse";
      lastPendingSearchSignatureRef.current = null;
      setShowAllAirportsPersisted(false);
      clearPendingFetch();
      clearSelectedDateAndOptions();
      latestSearchRequestRef.current += 1;
      setFlightPrices([]);
      setSearchError(null);
      setHasPendingFilterChanges(false);
      setLastSearchRoute(null);
      setRouteChangedSinceSearch(false);
      clearStoredSearchState();

      // Clear airport selections and input fields
      setOriginAirport(null);
      setDestinationAirport(null);
      setOriginQuery("");
      setDestinationQuery("");
      setActiveField("origin");
      setLastValidRoute(null);
      lastHydratedOriginIdRef.current = null;
      lastHydratedDestinationIdRef.current = null;

      // Clear all query params
      updateQueryState({
        origin: null,
        destination: null,
        dateFrom: null,
        dateTo: null,
        searchWindowDays: null,
        departureTimeFrom: null,
        departureTimeTo: null,
        arrivalTimeFrom: null,
        arrivalTimeTo: null,
        seatType: null,
        stops: null,
        airlines: null,
        daysOfWeek: null,
        selectedDate: null,
      });

      // Navigate to home
      if (shouldNavigate) {
        router.replace("/", { scroll: false });
      }

      if (mapCenter) {
        scheduleNearbyFetch(mapCenter.lat, mapCenter.lon, {
          force: true,
          immediate: true,
        });
      }
    },
    [
      clearPendingFetch,
      mapCenter,
      scheduleNearbyFetch,
      clearSelectedDateAndOptions,
      setShowAllAirportsPersisted,
      router,
      updateQueryState,
    ],
  );

  const formatAirportValue = useCallback(
    (airport: AirportData) => `${airport.name} (${airport.iata})`,
    [],
  );

  useEffect(() => {
    if (isInitialLoading && airports.length === 0) {
      return;
    }

    suppressQueryUpdatesRef.current = true;

    try {
      const defaults = createDefaultFilters();

      const findAirportByIata = (iata: string | null | undefined) => {
        if (!iata) return null;
        return (
          airports.find(
            (airport) => airport.iata.toUpperCase() === iata.toUpperCase(),
          ) ?? null
        );
      };

      const findAirportById = (value: string | null | undefined) => {
        if (!value) return null;
        return (
          airports.find((airport) => airport.id === value) ??
          airports.find(
            (airport) => airport.iata.toLowerCase() === value.toLowerCase(),
          ) ??
          null
        );
      };

      let resolvedOrigin: AirportData | null = null;
      let resolvedDestination: AirportData | null = null;
      let nextFilters = defaults;

      // PRIORITY 1: Read from query params (source of truth)
      const queryOrigin = queryState.origin;
      const queryDestination = queryState.destination;

      if (queryOrigin && queryDestination) {
        const originFromQuery = findAirportByIata(queryOrigin);
        const destinationFromQuery = findAirportByIata(queryDestination);

        if (originFromQuery && destinationFromQuery) {
          resolvedOrigin = originFromQuery;
          resolvedDestination = destinationFromQuery;

          // Read filters from query params if present
          if (queryState.dateFrom && queryState.dateTo) {
            const parsedFrom =
              parseQueryDate(queryState.dateFrom) ?? defaults.dateRange.from;
            const parsedTo =
              parseQueryDate(queryState.dateTo) ?? defaults.dateRange.to;

            const windowDays = clampToAllowedWindow(
              queryState.searchWindowDays ?? defaults.searchWindowDays,
            );

            const departureRange = ensureTimeRange({
              from: queryState.departureTimeFrom ?? 0,
              to: queryState.departureTimeTo ?? 24,
            });

            const arrivalRange = ensureTimeRange({
              from: queryState.arrivalTimeFrom ?? 0,
              to: queryState.arrivalTimeTo ?? 24,
            });

            const seatType = isSeatTypeValue(queryState.seatType)
              ? queryState.seatType
              : defaults.seatType;

            const stops = isMaxStopsValue(queryState.stops)
              ? queryState.stops
              : defaults.stops;

            const airlines = sanitizeStoredAirlines(queryState.airlines ?? []);
            const daysOfWeek = sanitizeStoredDaysOfWeek(
              queryState.daysOfWeek ?? [],
            );

            nextFilters = {
              dateRange: { from: parsedFrom, to: parsedTo },
              departureTimeRange: departureRange,
              arrivalTimeRange: arrivalRange,
              airlines,
              daysOfWeek,
              seatType,
              stops,
              searchWindowDays: windowDays,
            };
          }
        }
      }

      // PRIORITY 2: Fallback to sessionStorage if query params are empty
      if (!resolvedOrigin && !resolvedDestination) {
        const storedConfig = readStoredSearchState();

        if (storedConfig) {
          const originCandidate = findAirportById(storedConfig.originId);
          const destinationCandidate = findAirportById(
            storedConfig.destinationId,
          );

          if (originCandidate && destinationCandidate) {
            resolvedOrigin = originCandidate;
            resolvedDestination = destinationCandidate;
            nextFilters = filtersFromStoredState(storedConfig, defaults);
          } else {
            if (airports.length > 0) {
              clearStoredSearchState();
            }
          }
        }
      }

      setFilters((current) =>
        areFiltersEqual(current, nextFilters) ? current : nextFilters,
      );
      setCommittedFilters(cloneFilters(nextFilters));
      setHasPendingFilterChanges(false);

      if (resolvedOrigin) {
        lastHydratedOriginIdRef.current = resolvedOrigin.id;
        setOriginAirport(resolvedOrigin);
        const formattedOrigin = formatAirportValue(resolvedOrigin);
        setOriginQuery((previous) =>
          previous === formattedOrigin ? previous : formattedOrigin,
        );
      } else {
        lastHydratedOriginIdRef.current = null;
        setOriginAirport(null);
        setOriginQuery("");
      }

      if (resolvedDestination) {
        lastHydratedDestinationIdRef.current = resolvedDestination.id;
        setDestinationAirport(resolvedDestination);
        const formattedDestination = formatAirportValue(resolvedDestination);
        setDestinationQuery((previous) =>
          previous === formattedDestination ? previous : formattedDestination,
        );
      } else {
        lastHydratedDestinationIdRef.current = null;
        setDestinationAirport(null);
        setDestinationQuery("");
      }

      const hasValidRoute = Boolean(resolvedOrigin && resolvedDestination);

      if (hasValidRoute && resolvedOrigin && resolvedDestination) {
        setLastValidRoute((previous) => {
          if (
            previous &&
            previous.origin.id === resolvedOrigin.id &&
            previous.destination.id === resolvedDestination.id
          ) {
            return previous;
          }

          return {
            origin: resolvedOrigin,
            destination: resolvedDestination,
          };
        });
        setActiveField(null);
        setViewMode("browse");
        viewModeRef.current = "browse";
        setLastSearchRoute({
          originId: resolvedOrigin.id,
          destinationId: resolvedDestination.id,
        });
      } else {
        setLastValidRoute(null);
        setActiveField("origin");
        setViewMode("browse");
        viewModeRef.current = "browse";
        setLastSearchRoute(null);
      }

      setShowAllAirportsPersisted(!hasValidRoute);

      const selectedDateFromQuery = queryState.selectedDate ?? null;
      setSelectedDate(selectedDateFromQuery);
      setSelectedPriceIndex(null);

      if (hasValidRoute && resolvedOrigin && resolvedDestination) {
        const signature = buildSearchSignature(
          resolvedOrigin.id,
          resolvedDestination.id,
          nextFilters,
        );

        if (lastPendingSearchSignatureRef.current !== signature) {
          pendingInitialSearchRef.current = true;
          lastPendingSearchSignatureRef.current = signature;
          setInitialSearchToken((value) => value + 1);
        }
      } else {
        pendingInitialSearchRef.current = false;
        lastPendingSearchSignatureRef.current = null;
      }
    } finally {
      suppressQueryUpdatesRef.current = false;
      didHydrateFromQueryRef.current = true;
    }
  }, [
    airports,
    formatAirportValue,
    isInitialLoading,
    queryState.origin,
    queryState.destination,
    queryState.dateFrom,
    queryState.dateTo,
    queryState.searchWindowDays,
    queryState.departureTimeFrom,
    queryState.departureTimeTo,
    queryState.arrivalTimeFrom,
    queryState.arrivalTimeTo,
    queryState.seatType,
    queryState.stops,
    queryState.airlines,
    queryState.daysOfWeek,
    queryState.selectedDate,
    setShowAllAirportsPersisted,
  ]);

  // Sync airport selection to query params (but not during initial hydration)
  // Only sync on /search page - on home page, params are set when user clicks search
  useEffect(() => {
    if (!didHydrateFromQueryRef.current) {
      return;
    }

    if (suppressQueryUpdatesRef.current) {
      return;
    }

    // Only sync on /search page
    if (pathname !== "/search") {
      return;
    }

    // Only update query params for airports when we have a valid route
    // This keeps the URL clean and prevents premature navigation
    if (originAirport && destinationAirport) {
      const currentQueryOrigin = queryState.origin;
      const currentQueryDestination = queryState.destination;

      if (
        currentQueryOrigin !== originAirport.iata ||
        currentQueryDestination !== destinationAirport.iata
      ) {
        updateQueryState({
          origin: originAirport.iata,
          destination: destinationAirport.iata,
        });
      }
    }
  }, [
    originAirport,
    destinationAirport,
    queryState.origin,
    queryState.destination,
    updateQueryState,
    pathname,
  ]);

  const handleOriginChange = useCallback(
    (value: string) => {
      setOriginQuery(value);
      setActiveField("origin");

      const trimmed = value.trim();

      if (trimmed) {
        setShowAllAirportsPersisted(false);
      } else {
        setShowAllAirportsPersisted(true);
      }

      if (
        originAirport &&
        trimmed &&
        value !== formatAirportValue(originAirport)
      ) {
        setOriginAirport(null);
        setDestinationAirport(null);
        setDestinationQuery("");
        lastHydratedOriginIdRef.current = null;
        lastHydratedDestinationIdRef.current = null;
      }

      if (!trimmed) {
        const hadPreviousRoute =
          Boolean(originAirport) ||
          Boolean(destinationAirport) ||
          Boolean(lastValidRoute);

        setOriginAirport(null);
        setDestinationAirport(null);
        setDestinationQuery("");
        lastHydratedOriginIdRef.current = null;
        lastHydratedDestinationIdRef.current = null;

        // Only reset and navigate if we're on /search without valid query params
        if (hadPreviousRoute && pathname === "/search") {
          const hasValidQueryRoute = Boolean(
            queryState.origin && queryState.destination,
          );
          if (!hasValidQueryRoute) {
            resetToBrowse({ shouldNavigate: true });
          }
        }
        return;
      }

      setViewMode("search");
    },
    [
      destinationAirport,
      formatAirportValue,
      lastValidRoute,
      pathname,
      originAirport,
      queryState.origin,
      queryState.destination,
      resetToBrowse,
      setShowAllAirportsPersisted,
    ],
  );

  const handleDestinationChange = useCallback(
    (value: string) => {
      setDestinationQuery(value);
      setActiveField("destination");

      const trimmed = value.trim();

      if (trimmed) {
        setShowAllAirportsPersisted(false);
      }

      if (
        destinationAirport &&
        trimmed &&
        value !== formatAirportValue(destinationAirport)
      ) {
        setDestinationAirport(null);
        lastHydratedDestinationIdRef.current = null;
      }

      if (!trimmed) {
        setDestinationAirport(null);
        lastHydratedDestinationIdRef.current = null;
      } else {
        setViewMode("search");
      }
    },
    [destinationAirport, formatAirportValue, setShowAllAirportsPersisted],
  );

  const handleOriginSelect = useCallback(
    (airport: AirportData | null) => {
      if (!airport) {
        const hadRoute =
          Boolean(originAirport) ||
          Boolean(destinationAirport) ||
          Boolean(lastValidRoute);

        setOriginAirport(null);
        setOriginQuery("");
        setDestinationAirport(null);
        setDestinationQuery("");
        setActiveField("origin");
        setViewMode("browse");

        // Only reset and navigate if we're on /search without valid query params
        if (hadRoute && pathname === "/search") {
          const hasValidQueryRoute = Boolean(
            queryState.origin && queryState.destination,
          );
          if (!hasValidQueryRoute) {
            resetToBrowse({ shouldNavigate: true });
          }
        }

        setLastValidRoute(null);
        setShowAllAirportsPersisted(true);
        lastHydratedOriginIdRef.current = null;
        lastHydratedDestinationIdRef.current = null;
        return;
      }

      setOriginAirport(airport);
      setShowAllAirportsPersisted(false);
      const formatted = formatAirportValue(airport);
      setOriginQuery(formatted);
      const matchesDestination =
        destinationAirport && destinationAirport.id === airport.id;

      if (matchesDestination) {
        setDestinationAirport(null);
        setDestinationQuery("");
        lastHydratedDestinationIdRef.current = null;
      }

      const shouldPromptDestination = !destinationAirport || matchesDestination;

      setActiveField(shouldPromptDestination ? "destination" : null);
      setViewMode(shouldPromptDestination ? "search" : "browse");
    },
    [
      destinationAirport,
      formatAirportValue,
      lastValidRoute,
      originAirport,
      pathname,
      queryState.origin,
      queryState.destination,
      resetToBrowse,
      setShowAllAirportsPersisted,
    ],
  );

  const handleDestinationSelect = useCallback(
    (airport: AirportData | null) => {
      if (!airport) {
        setDestinationAirport(null);
        setDestinationQuery("");
        setActiveField("destination");
        setViewMode("search");
        lastHydratedDestinationIdRef.current = null;
        return;
      }

      if (originAirport && airport.id === originAirport.id) {
        setDestinationAirport(null);
        setDestinationQuery("");
        setActiveField("destination");
        setViewMode("search");
        lastHydratedDestinationIdRef.current = null;
        return;
      }

      setDestinationAirport(airport);
      setShowAllAirportsPersisted(false);
      const formatted = formatAirportValue(airport);
      setDestinationQuery(formatted);
      setActiveField(null);
      setViewMode("browse");
      if (originAirport) {
        setLastValidRoute((previous) => {
          if (
            previous &&
            previous.origin.id === originAirport.id &&
            previous.destination.id === airport.id
          ) {
            return previous;
          }

          return { origin: originAirport, destination: airport };
        });
      }
    },
    [formatAirportValue, originAirport, setShowAllAirportsPersisted],
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
      setShowAllAirportsPersisted(false);

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
    [
      activeField,
      handleDestinationSelect,
      handleOriginSelect,
      originAirport,
      setShowAllAirportsPersisted,
    ],
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

      const nextFilters: FiltersState = {
        ...filters,
        dateRange: {
          from: normalizedFrom,
          to,
        },
        searchWindowDays: windowDays,
      };

      if (areFiltersEqual(filters, nextFilters)) {
        return;
      }

      setFilters(nextFilters);
      markFiltersDirty();
    },
    [filters, markFiltersDirty],
  );

  const handleDepartureTimeRangeChange = useCallback(
    (range: TimeRangeValue | null) => {
      const nextRange = ensureTimeRange(range);
      if (
        filters.departureTimeRange.from === nextRange.from &&
        filters.departureTimeRange.to === nextRange.to
      ) {
        return;
      }

      const nextFilters: FiltersState = {
        ...filters,
        departureTimeRange: nextRange,
      };

      setFilters(nextFilters);
      markFiltersDirty();
    },
    [filters, markFiltersDirty],
  );

  const handleArrivalTimeRangeChange = useCallback(
    (range: TimeRangeValue | null) => {
      const nextRange = ensureTimeRange(range);
      if (
        filters.arrivalTimeRange.from === nextRange.from &&
        filters.arrivalTimeRange.to === nextRange.to
      ) {
        return;
      }

      const nextFilters: FiltersState = {
        ...filters,
        arrivalTimeRange: nextRange,
      };

      setFilters(nextFilters);
      markFiltersDirty();
    },
    [filters, markFiltersDirty],
  );

  const handleAirlinesChange = useCallback(
    (codes: string[]) => {
      const normalized = Array.from(
        new Set(
          codes
            .map((code) => code.trim().toUpperCase())
            .filter((code) => code.length > 0),
        ),
      );

      if (
        normalized.length === filters.airlines.length &&
        normalized.every((code, index) => code === filters.airlines[index])
      ) {
        return;
      }

      const nextFilters: FiltersState = {
        ...filters,
        airlines: normalized,
      };

      setFilters(nextFilters);
      markFiltersDirty();
    },
    [filters, markFiltersDirty],
  );

  const handleDaysOfWeekChange = useCallback(
    (days: number[]) => {
      const normalized = Array.from(
        new Set(
          days.filter(
            (day): day is number =>
              typeof day === "number" &&
              Number.isInteger(day) &&
              day >= 0 &&
              day <= 6,
          ),
        ),
      ).sort((a, b) => a - b);

      if (arraysShallowEqual(normalized, filters.daysOfWeek)) {
        return;
      }

      const nextFilters: FiltersState = {
        ...filters,
        daysOfWeek: normalized,
      };

      setFilters(nextFilters);
      markFiltersDirty();
    },
    [filters, markFiltersDirty],
  );

  const handleSeatTypeChange = useCallback(
    (seatType: SeatType) => {
      if (filters.seatType === seatType) {
        return;
      }

      const nextFilters: FiltersState = {
        ...filters,
        seatType,
      };

      setFilters(nextFilters);
      markFiltersDirty();
    },
    [filters, markFiltersDirty],
  );

  const handleStopsChange = useCallback(
    (stops: MaxStops) => {
      if (filters.stops === stops) {
        return;
      }

      const nextFilters: FiltersState = {
        ...filters,
        stops,
      };

      setFilters(nextFilters);
      markFiltersDirty();
    },
    [filters, markFiltersDirty],
  );

  const handleSearchWindowDaysChange = useCallback(
    (days: number) => {
      const clamped = clampToAllowedWindow(days);
      const { from } = filters.dateRange;
      const { from: normalizedFrom, to } = computeDateRange(from, clamped);

      const nextFilters: FiltersState = {
        ...filters,
        dateRange: {
          from: normalizedFrom,
          to,
        },
        searchWindowDays: clamped,
      };

      if (areFiltersEqual(filters, nextFilters)) {
        return;
      }

      setFilters(nextFilters);
      markFiltersDirty();
    },
    [filters, markFiltersDirty],
  );

  const handleResetFilters = useCallback(() => {
    clearSelectedDateAndOptions();
    const defaults = createDefaultFilters();
    setFilters(defaults);
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

      const segment: FlightFiltersPayload["segments"][number] = {
        origin: route.origin.iata,
        destination: route.destination.iata,
        departureDate: segmentDeparture,
      };

      const normalizedDeparture = normalizeTimeRange(
        filters.departureTimeRange,
      );
      if (
        !isFullDayTimeRange(filters.departureTimeRange) &&
        normalizedDeparture
      ) {
        segment.departureTimeRange = normalizedDeparture;
      }

      const normalizedArrival = normalizeTimeRange(filters.arrivalTimeRange);
      if (!isFullDayTimeRange(filters.arrivalTimeRange) && normalizedArrival) {
        segment.arrivalTimeRange = normalizedArrival;
      }

      const payload: FlightFiltersPayload = {
        tripType: TripType.ONE_WAY,
        segments: [segment],
        passengers: { ...DEFAULT_PASSENGERS },
        dateRange: effectiveDateRange,
      };

      if (filters.seatType !== SeatType.ECONOMY) {
        payload.seatType = filters.seatType;
      }

      if (filters.stops !== MaxStops.ANY) {
        payload.stops = filters.stops;
      }

      if (filters.airlines.length > 0) {
        payload.airlines = filters.airlines;
      }

      if (filters.daysOfWeek.length > 0) {
        payload.daysOfWeek = [...filters.daysOfWeek];
      }

      return payload;
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
  const isSearchRoute = pathname === "/search";
  const hasCurrentRoute = Boolean(originAirport && destinationAirport);
  const shouldShowSearchAction = hasCurrentRoute;
  const isEditing = activeField !== null;

  const hasSelectedRoute = hasCurrentRoute;
  const isSearching = flightsDatesMutation.isLoading;
  const isSearchDisabled = isSearching || !hasSelectedRoute;

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

  const shouldShowPricePanel = isSearchRoute || isSearching;

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
      filters.daysOfWeek.length > 0 ||
      !hasDefaultDeparture ||
      !hasDefaultArrival ||
      filters.seatType !== defaults.seatType ||
      filters.stops !== defaults.stops ||
      filters.searchWindowDays !== defaults.searchWindowDays
    );
  }, [filters]);

  const canRefetch = isSearchRoute && hasPendingFilterChanges && !isSearching;

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

  const performSearch = useCallback(
    async (options?: { preserveSelection?: boolean }) => {
      const preserveSelection = options?.preserveSelection ?? false;
      const previouslySelectedDate = selectedDate;
      const route =
        originAirport && destinationAirport
          ? { origin: originAirport, destination: destinationAirport }
          : lastValidRoute;

      if (!route) {
        return;
      }

      setSearchError(null);
      const signature = buildSearchSignature(
        route.origin.id,
        route.destination.id,
        filters,
      );
      lastPendingSearchSignatureRef.current = signature;
      pendingInitialSearchRef.current = false;
      const snapshot = cloneFilters(filters);
      const config = buildStoredSearchState(
        route.origin.id,
        route.destination.id,
        snapshot,
      );
      writeStoredSearchState(config);

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
        setCommittedFilters(snapshot);
        setHasPendingFilterChanges(false);

        let finalSelectedDate: string | null = null;

        if (preserveSelection && previouslySelectedDate) {
          const index = sanitized.findIndex(
            (entry) => entry.date === previouslySelectedDate,
          );

          if (index >= 0) {
            finalSelectedDate = previouslySelectedDate;
            setSelectedPriceIndex((previousIndex) =>
              previousIndex === index ? previousIndex : index,
            );
            void loadFlightOptions(previouslySelectedDate);
          } else {
            clearSelectedDateAndOptions();
          }
        }

        const dateFrom = formatIsoDate(snapshot.dateRange.from);
        const dateTo = formatIsoDate(snapshot.dateRange.to);
        const departureTimeFrom = !isFullDayTimeRange(
          snapshot.departureTimeRange,
        )
          ? snapshot.departureTimeRange.from
          : null;
        const departureTimeTo = !isFullDayTimeRange(snapshot.departureTimeRange)
          ? snapshot.departureTimeRange.to
          : null;
        const arrivalTimeFrom = !isFullDayTimeRange(snapshot.arrivalTimeRange)
          ? snapshot.arrivalTimeRange.from
          : null;
        const arrivalTimeTo = !isFullDayTimeRange(snapshot.arrivalTimeRange)
          ? snapshot.arrivalTimeRange.to
          : null;
        const seatTypeValue =
          snapshot.seatType !== SeatType.ECONOMY ? snapshot.seatType : null;
        const stopsValue =
          snapshot.stops !== MaxStops.ANY ? snapshot.stops : null;
        const airlinesValue =
          snapshot.airlines.length > 0 ? [...snapshot.airlines] : null;
        const daysOfWeekValue =
          snapshot.daysOfWeek.length > 0 ? [...snapshot.daysOfWeek] : null;

        if (pathname === "/search") {
          updateQueryState({
            origin: route.origin.iata,
            destination: route.destination.iata,
            dateFrom,
            dateTo,
            searchWindowDays: snapshot.searchWindowDays,
            departureTimeFrom,
            departureTimeTo,
            arrivalTimeFrom,
            arrivalTimeTo,
            seatType: seatTypeValue,
            stops: stopsValue,
            airlines: airlinesValue,
            daysOfWeek: daysOfWeekValue,
            selectedDate: finalSelectedDate,
          });
        }

        // Navigate to /search with query params
        // Build query string manually to ensure navigation happens correctly
        const params = new URLSearchParams();
        const setParam = (key: string, value: unknown) => {
          if (value === null || value === undefined) return;
          if (Array.isArray(value)) {
            if (value.length > 0) params.set(key, value.join(","));
            return;
          }
          const stringValue = String(value);
          if (stringValue.length > 0) params.set(key, stringValue);
        };

        setParam("origin", route.origin.iata);
        setParam("destination", route.destination.iata);
        setParam("dateFrom", dateFrom);
        setParam("dateTo", dateTo);
        setParam("searchWindowDays", snapshot.searchWindowDays);
        setParam("selectedDate", finalSelectedDate);
        setParam("departureTimeFrom", departureTimeFrom);
        setParam("departureTimeTo", departureTimeTo);
        setParam("arrivalTimeFrom", arrivalTimeFrom);
        setParam("arrivalTimeTo", arrivalTimeTo);
        setParam("seatType", seatTypeValue);
        setParam("stops", stopsValue);
        setParam("airlines", airlinesValue);
        setParam("daysOfWeek", daysOfWeekValue);

        const search = params.toString();
        const target = `/search${search ? `?${search}` : ""}`;

        router.replace(target, { scroll: false });
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
      filters,
      flightsDatesMutation,
      loadFlightOptions,
      lastValidRoute,
      originAirport,
      pathname,
      router,
      selectedDate,
      updateQueryState,
    ],
  );

  useEffect(() => {
    if (!didHydrateFromQueryRef.current) {
      return;
    }

    if (!pendingInitialSearchRef.current) {
      return;
    }

    // Only auto-search when on /search page (i.e., hydrating from URL)
    // On home page, user must explicitly click search button
    if (pathname !== "/search") {
      return;
    }

    // Don't trigger search if one is already in progress
    if (flightsDatesMutation.isLoading) {
      return;
    }

    const hasResolvedRoute = Boolean(
      (originAirport && destinationAirport) || lastValidRoute,
    );

    if (!hasResolvedRoute) {
      return;
    }

    pendingInitialSearchRef.current = false;
    void performSearch({ preserveSelection: true });
  }, [
    destinationAirport,
    lastValidRoute,
    originAirport,
    performSearch,
    flightsDatesMutation.isLoading,
    pathname,
  ]);

  const handleSearchClick = useCallback(() => {
    void performSearch();
  }, [performSearch]);

  const handleResetSearch = useCallback(() => {
    // Clear filters first
    handleResetFilters();
    // Then clear search and navigate home
    resetToBrowse({ shouldNavigate: true });
  }, [handleResetFilters, resetToBrowse]);

  const handleRefetch = useCallback(() => {
    if (!hasPendingFilterChanges) {
      return;
    }

    void performSearch({ preserveSelection: true });
  }, [hasPendingFilterChanges, performSearch]);

  const handleSelectPriceIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= flightPrices.length) {
        clearSelectedDateAndOptions();
        updateQueryState({ selectedDate: null });
        return;
      }

      const entry = flightPrices[index];
      setSelectedPriceIndex(index);
      setSelectedDate(entry.date);
      void loadFlightOptions(entry.date);
      updateQueryState({ selectedDate: entry.date });
    },
    [
      clearSelectedDateAndOptions,
      flightPrices,
      loadFlightOptions,
      updateQueryState,
    ],
  );

  const handleSelectDate = useCallback(
    (isoDate: string | null) => {
      if (!isoDate) {
        clearSelectedDateAndOptions();
        updateQueryState({ selectedDate: null });
        return;
      }

      const normalized = formatIsoDate(parseISO(isoDate));
      setSelectedDate(normalized);
      const index = flightPrices.findIndex(
        (entry) => entry.date === normalized,
      );
      setSelectedPriceIndex(index >= 0 ? index : null);
      void loadFlightOptions(normalized);
      updateQueryState({ selectedDate: normalized });
    },
    [
      clearSelectedDateAndOptions,
      flightPrices,
      loadFlightOptions,
      updateQueryState,
    ],
  );

  const handleShowAllAirportsClick = useCallback(() => {
    setShowAllAirportsPersisted(true);
    setViewMode("browse");
    viewModeRef.current = "browse";
    setActiveField(null);
    lastPendingSearchSignatureRef.current = null;
    setOriginAirport(null);
    setDestinationAirport(null);
    setOriginQuery("");
    setDestinationQuery("");
    setLastValidRoute(null);
    clearSelectedDateAndOptions();
    clearPendingFetch();
    latestSearchRequestRef.current += 1;
    setFlightPrices([]);
    setSearchError(null);
    setHasPendingFilterChanges(false);
    setLastSearchRoute(null);
    setRouteChangedSinceSearch(false);
    setIsLoadingNearby(false);
    lastHydratedOriginIdRef.current = null;
    lastHydratedDestinationIdRef.current = null;
    clearStoredSearchState();
    updateQueryState({
      selectedDate: null,
    });

    if (pathname !== "/") {
      router.replace("/", { scroll: false });
    }

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
  }, [
    clearPendingFetch,
    clearSelectedDateAndOptions,
    pathname,
    router,
    setShowAllAirportsPersisted,
    updateQueryState,
  ]);

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
    daysOfWeek: filters.daysOfWeek,
    seatType: filters.seatType,
    stops: filters.stops,
    searchWindowDays: filters.searchWindowDays,
    hasCustomFilters,
    hasPendingChanges: hasPendingFilterChanges,
    onDateRangeChange: handleDateRangeChange,
    onDepartureTimeRangeChange: handleDepartureTimeRangeChange,
    onArrivalTimeRangeChange: handleArrivalTimeRangeChange,
    onAirlinesChange: handleAirlinesChange,
    onDaysOfWeekChange: handleDaysOfWeekChange,
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
      onReset: handleResetSearch,
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
