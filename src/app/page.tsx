"use client";

import { format, parseISO } from "date-fns";
import { Loader2, MapPin, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { AirportMap } from "@/components/airport-map";
import { AirportSearch } from "@/components/airport-search";
import { Header } from "@/components/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { type MapKitMap, mapKitLoader } from "@/lib/mapkit-service";
import { trpc } from "@/lib/trpc/react";
import { cn } from "@/lib/utils";
import type { AirportData } from "@/server/services/airports";

type ViewMode = "browse" | "search";

type FlightPricePoint = {
  date: string;
  price: number;
};

const PRICE_CHART_CONFIG = {
  price: {
    label: "Price (USD)",
    color: "var(--chart-1)",
  },
} as const;

const USD_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const MAX_SEARCH_DAYS = 90;

const FETCH_DEBOUNCE_MS = 350;
const MOVEMENT_THRESHOLD_DEGREES = 0.05;

export default function Home() {
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
  const { data: airportSearchData, isLoading: isLoadingAirports } =
    trpc.useQuery(["airports.search", { limit: 10000 }]);
  const airports = airportSearchData?.airports ?? [];
  const totalAirports = airportSearchData?.total ?? airports.length;
  const isLoading = isLoadingAirports && airports.length === 0;

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

  const formatAirportValue = useCallback(
    (airport: AirportData) => `${airport.name} (${airport.iata})`,
    [],
  );

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

  const renderSummaryButton = useCallback(
    (
      airport: AirportData,
      label: "origin" | "destination",
      onClick: () => void,
    ) => (
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full justify-start gap-3 transition-all duration-200"
        onClick={onClick}
      >
        <MapPin className="h-4 w-4 text-primary" />
        <div className="flex flex-col text-left">
          <span className="text-sm font-semibold">{airport.iata}</span>
          <span className="text-xs text-muted-foreground truncate">
            {airport.city}, {airport.country}
          </span>
        </div>
        <span className="sr-only">Edit {label} airport</span>
      </Button>
    ),
    [],
  );

  const renderSearchField = useCallback(
    (
      field: "origin" | "destination",
      value: string,
      onChange: (value: string) => void,
      onSelect: (airport: AirportData | null) => void,
      placeholder: string,
      ariaLabel: string,
      autoFocusFlag: boolean,
      onBlur?: () => void,
    ) => (
      <AirportSearch
        airports={airports}
        value={value}
        onChange={onChange}
        onSelect={onSelect}
        onFocus={() => {
          setActiveField(field);
          setViewMode("search");
        }}
        onBlur={onBlur}
        placeholder={placeholder}
        inputAriaLabel={ariaLabel}
        autoFocus={autoFocusFlag}
        isLoading={isLoading}
        className="w-full transition-all duration-200 ease-in-out"
      />
    ),
    [airports, isLoading],
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
    if (isLoading) return "Loading airports...";

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
    totalAirports,
    destinationAirport,
    destinationQuery,
    isLoading,
    isLoadingNearby,
    nearbyAirports.length,
    originAirport,
    showAllAirports,
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

  const chartData = useMemo(() => {
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

  return (
    <div className="flex flex-col h-screen w-full bg-background">
      <Header />
      <div className="flex-none border-b bg-card/50 backdrop-blur-sm z-10">
        <div className="container mx-auto p-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-1 sm:items-stretch">
              <div
                className={cn(
                  "transition-all duration-200 ease-in-out",
                  originAirport && activeField !== "origin"
                    ? "sm:w-60"
                    : "sm:flex-1",
                  activeField === "origin"
                    ? "opacity-100"
                    : originAirport
                      ? "opacity-90"
                      : "opacity-100",
                )}
              >
                {!originAirport || activeField === "origin"
                  ? renderSearchField(
                      "origin",
                      originQuery,
                      handleOriginChange,
                      handleOriginSelect,
                      "Search origin airport...",
                      "Search origin airport",
                      true,
                      () => handleFieldBlur("origin"),
                    )
                  : renderSummaryButton(originAirport, "origin", () => {
                      setActiveField("origin");
                      setViewMode("search");
                    })}
              </div>

              {(originAirport || activeField === "destination") && (
                <div
                  className={cn(
                    "transition-all duration-200 ease-in-out",
                    destinationAirport && activeField !== "destination"
                      ? "sm:w-60"
                      : "sm:flex-1",
                    activeField === "destination"
                      ? "opacity-100"
                      : destinationAirport
                        ? "opacity-90"
                        : "opacity-75",
                  )}
                >
                  {destinationAirport && activeField !== "destination"
                    ? renderSummaryButton(
                        destinationAirport,
                        "destination",
                        () => {
                          setActiveField("destination");
                          setViewMode("search");
                        },
                      )
                    : renderSearchField(
                        "destination",
                        destinationQuery,
                        handleDestinationChange,
                        handleDestinationSelect,
                        "Add destination airport...",
                        "Search destination airport",
                        activeField === "destination" || !destinationAirport,
                        () => handleFieldBlur("destination"),
                      )}
                </div>
              )}
            </div>

            {shouldShowSearchAction && (
              <div className="flex w-full sm:ml-auto sm:w-auto sm:items-center sm:justify-end">
                <Button
                  type="button"
                  className={cn(
                    "h-12 w-full justify-center gap-2",
                    "sm:w-auto sm:px-4",
                    isEditing ? "sm:w-12 sm:px-0 sm:gap-0" : "",
                  )}
                  disabled={isSearchDisabled}
                  onClick={handleSearchClick}
                >
                  {isSearching ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Search className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      isEditing ? "sm:hidden" : "",
                    )}
                  >
                    {isSearching ? "Searching..." : "Search Flights"}
                  </span>
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-sm min-h-[20px]">
            <p className="text-muted-foreground flex items-center gap-2">
              {(isLoading || isLoadingNearby) && (
                <Loader2 className="h-3 w-3 animate-spin" />
              )}
              {displayMessage}
            </p>
            <Badge
              asChild
              variant="secondary"
              className="hidden sm:flex cursor-pointer"
            >
              <button
                type="button"
                onClick={handleShowAllAirportsClick}
                className="flex items-center gap-1"
                aria-label="Show all airports worldwide"
              >
                Support {totalAirports.toLocaleString()} Total Airports
              </button>
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex-1 relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
            <Card className="p-6 flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium">Loading airports...</span>
            </Card>
          </div>
        ) : shouldShowPricePanel ? (
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
                  <ChartContainer
                    config={PRICE_CHART_CONFIG}
                    className="h-64 w-full"
                  >
                    <LineChart
                      data={chartData}
                      margin={{ left: 12, right: 12 }}
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
        ) : (
          <AirportMap
            airports={displayedAirports}
            originAirport={originAirport}
            destinationAirport={destinationAirport}
            showAllAirports={showAllAirports}
            onMapReady={handleMapReady}
            onAirportClick={handleAirportClick}
          />
        )}
      </div>
    </div>
  );
}
