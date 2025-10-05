"use client";

import { format, parseISO } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type MapKitMap, mapKitLoader } from "@/lib/mapkit-service";
import { trpc } from "@/lib/trpc/react";
import type { AirportData } from "@/server/services/airports";
import { type FlightPricePoint, MAX_SEARCH_DAYS } from "./constants";

type ViewMode = "browse" | "search";

const FETCH_DEBOUNCE_MS = 350;
const MOVEMENT_THRESHOLD_DEGREES = 0.05;

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
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const viewModeRef = useRef<ViewMode>("browse");
  const pendingFetchTimeoutRef = useRef<number | null>(null);
  const lastFetchRef = useRef<{ lat: number; lon: number } | null>(null);
  const mapInstanceRef = useRef<MapKitMap | null>(null);
  const latestNearbyRequestRef = useRef(0);
  const searchAbortRef = useRef<AbortController | null>(null);
  const trpcContext = trpc.useContext();

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
      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
        searchAbortRef.current = null;
      }
    };
  }, [clearPendingFetch]);

  const resetToBrowse = useCallback(() => {
    setViewMode("browse");
    viewModeRef.current = "browse";
    setShowAllAirports(false);
    clearPendingFetch();
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
      searchAbortRef.current = null;
    }
    setIsSearching(false);
    setFlightPrices([]);
    setSearchError(null);
    setHasSearched(false);

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

  const isSearchDisabled = (isEditing && isActiveFieldDirty) || isSearching;

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

  const performSearch = useCallback(async () => {
    const route =
      originAirport && destinationAirport
        ? { origin: originAirport, destination: destinationAirport }
        : lastValidRoute;

    if (!route) {
      return;
    }

    setHasSearched(true);

    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }

    const controller = new AbortController();
    searchAbortRef.current = controller;

    setIsSearching(true);
    setSearchError(null);

    try {
      const response = await fetch("/api/flights/cheapest", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          origin: route.origin.iata,
          destination: route.destination.iata,
          days: MAX_SEARCH_DAYS,
        }),
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => null)) as {
        prices?: FlightPricePoint[];
        error?: string;
      } | null;

      if (!response.ok) {
        const message =
          (payload?.error && typeof payload.error === "string"
            ? payload.error
            : undefined) ?? "Failed to search flights";
        throw new Error(message);
      }

      if (!controller.signal.aborted) {
        const sanitized = Array.isArray(payload?.prices)
          ? payload.prices.filter(
              (item): item is FlightPricePoint =>
                item !== null &&
                typeof item === "object" &&
                typeof item.date === "string" &&
                typeof item.price === "number",
            )
          : [];
        setFlightPrices(sanitized);
      }
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") {
        return;
      }
      setSearchError(
        error instanceof Error && error.message
          ? error.message
          : "Failed to search flights",
      );
    } finally {
      if (searchAbortRef.current === controller) {
        searchAbortRef.current = null;
      }
      if (!controller.signal.aborted) {
        setIsSearching(false);
      }
    }
  }, [destinationAirport, lastValidRoute, originAirport]);

  const handleSearchClick = useCallback(() => {
    void performSearch();
  }, [performSearch]);

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
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
      searchAbortRef.current = null;
    }
    setIsSearching(false);
    setFlightPrices([]);
    setSearchError(null);
    setHasSearched(false);
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
    },
  };
}
