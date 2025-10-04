"use client";

import { Loader2, MapPin } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AirportData } from "@/app/api/airports/route";
import { AirportMap } from "@/components/airport-map";
import { AirportSearch } from "@/components/airport-search";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type ViewMode = "browse" | "search";

const FETCH_DEBOUNCE_MS = 350;
const MOVEMENT_THRESHOLD_DEGREES = 0.05;

export default function Home() {
  const [airports, setAirports] = useState<AirportData[]>([]);
  const [displayedAirports, setDisplayedAirports] = useState<AirportData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAirport, setSelectedAirport] = useState<AirportData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("browse");
  const [mapCenter, setMapCenter] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);

  const viewModeRef = useRef<ViewMode>("browse");
  const pendingFetchTimeoutRef = useRef<number | null>(null);
  const nearbyAbortRef = useRef<AbortController | null>(null);
  const lastFetchRef = useRef<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    const fetchAirports = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/airports");
        const data = await response.json();
        setAirports(data.airports);
      } catch (error) {
        console.error("Failed to fetch airports:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAirports();
  }, []);

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

      if (nearbyAbortRef.current) {
        nearbyAbortRef.current.abort();
      }

      const controller = new AbortController();
      nearbyAbortRef.current = controller;
      lastFetchRef.current = { lat, lon };

      try {
        setIsLoadingNearby(true);
        const response = await fetch(
          `/api/airports?lat=${lat}&lon=${lon}&radius=100`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error(
            `Failed to fetch nearby airports: ${response.status}`,
          );
        }

        const data = await response.json();

        if (controller.signal.aborted) {
          return;
        }

        if (options.force || viewModeRef.current === "browse") {
          setDisplayedAirports(data.airports);
        }
      } catch (error) {
        if ((error as DOMException)?.name === "AbortError") {
          return;
        }
        console.error("Failed to fetch nearby airports:", error);
      } finally {
        if (nearbyAbortRef.current === controller) {
          nearbyAbortRef.current = null;
          setIsLoadingNearby(false);
        }
      }
    },
    [],
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
      if (nearbyAbortRef.current) {
        nearbyAbortRef.current.abort();
      }
    };
  }, [clearPendingFetch]);

  const handleMapReady = useCallback(
    // biome-ignore lint/suspicious/noExplicitAny: MapKit types are loaded at runtime
    (map: any) => {
      const center = map.center;
      setMapCenter({ lat: center.latitude, lon: center.longitude });

      scheduleNearbyFetch(center.latitude, center.longitude, {
        force: true,
        immediate: true,
      });

      map.addEventListener("region-change-start", () => {
        clearPendingFetch();
        if (nearbyAbortRef.current) {
          nearbyAbortRef.current.abort();
        }
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

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);

      if (!value.trim()) {
        setViewMode("browse");
        setSelectedAirport(null);
        clearPendingFetch();

        if (mapCenter) {
          scheduleNearbyFetch(mapCenter.lat, mapCenter.lon, {
            force: true,
            immediate: true,
          });
        }
      } else {
        setViewMode("search");
      }
    },
    [mapCenter, scheduleNearbyFetch, clearPendingFetch],
  );

  const handleAirportSelect = useCallback((airport: AirportData | null) => {
    setSelectedAirport(airport);

    if (airport) {
      setDisplayedAirports([airport]);
      setViewMode("search");
    }
  }, []);

  const handleAirportClick = useCallback((airport: AirportData) => {
    setSelectedAirport(airport);
    setSearchQuery(`${airport.name} (${airport.iata})`);
    setViewMode("search");
  }, []);

  const displayMessage = useMemo(() => {
    if (isLoading) return "Loading airports...";
    if (isLoadingNearby && viewMode === "browse") {
      return "Loading nearby airports...";
    }

    if (viewMode === "search" && selectedAirport) {
      return `Selected: ${selectedAirport.name} (${selectedAirport.iata})`;
    }

    if (viewMode === "browse") {
      return `Showing ${displayedAirports.length} airports within 100 miles`;
    }

    return `${displayedAirports.length} airports`;
  }, [
    isLoading,
    isLoadingNearby,
    viewMode,
    selectedAirport,
    displayedAirports.length,
  ]);

  return (
    <div className="flex flex-col h-screen w-full bg-background">
      <div className="flex-none border-b bg-card/50 backdrop-blur-sm z-10">
        <div className="container mx-auto p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight">
                Flights Tracker
              </h1>
            </div>
            <Badge variant="secondary" className="hidden sm:flex">
              {airports.length.toLocaleString()} Total Airports
            </Badge>
          </div>

          <AirportSearch
            airports={airports}
            value={searchQuery}
            onChange={handleSearchChange}
            onSelect={handleAirportSelect}
            isLoading={isLoading}
          />

          <div className="flex items-center justify-between text-sm min-h-[20px]">
            <p className="text-muted-foreground flex items-center gap-2">
              {(isLoading || isLoadingNearby) && (
                <Loader2 className="h-3 w-3 animate-spin" />
              )}
              {displayMessage}
            </p>
            {viewMode === "browse" && (
              <Badge variant="outline" className="text-xs hidden sm:flex">
                Browse Mode • 100mi radius
              </Badge>
            )}
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
        ) : (
          <AirportMap
            airports={displayedAirports}
            selectedAirport={selectedAirport}
            onMapReady={handleMapReady}
            onAirportClick={handleAirportClick}
          />
        )}
      </div>
    </div>
  );
}
