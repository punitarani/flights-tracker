"use client";

import type { User } from "@supabase/supabase-js";
import { Loader2, LogIn, LogOut, MapPin, UserRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AirportData } from "@/app/api/airports/route";
import { AirportMap } from "@/components/airport-map";
import { AirportSearch } from "@/components/airport-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type ViewMode = "browse" | "search";

const FETCH_DEBOUNCE_MS = 350;
const MOVEMENT_THRESHOLD_DEGREES = 0.05;

export default function Home() {
  const [airports, setAirports] = useState<AirportData[]>([]);
  const [nearbyAirports, setNearbyAirports] = useState<AirportData[]>([]);
  const [originQuery, setOriginQuery] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [originAirport, setOriginAirport] = useState<AirportData | null>(null);
  const [destinationAirport, setDestinationAirport] =
    useState<AirportData | null>(null);
  const [activeField, setActiveField] = useState<
    "origin" | "destination" | null
  >("origin");
  const [isLoading, setIsLoading] = useState(true);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
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

  const displayedAirports = useMemo(() => {
    if (originAirport && destinationAirport) {
      return [originAirport, destinationAirport];
    }

    if (originAirport) {
      return [originAirport];
    }

    return nearbyAirports;
  }, [destinationAirport, originAirport, nearbyAirports]);

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

  useEffect(() => {
    const supabase = createClient();

    supabase.auth
      .getUser()
      .then(({ data }) => {
        setAuthUser(data.user ?? null);
      })
      .catch((error) => {
        console.error("Failed to fetch auth user:", error);
      });
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      setAuthUser(null);
      setIsProfileOpen(false);
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
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
          setNearbyAirports(data.airports);
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

  const formatAirportValue = useCallback(
    (airport: AirportData) => `${airport.name} (${airport.iata})`,
    [],
  );

  const resetToBrowse = useCallback(() => {
    setViewMode("browse");
    clearPendingFetch();

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
        return;
      }

      setOriginAirport(airport);
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
      setDestinationQuery(formatAirportValue(airport));
      setActiveField(null);
      setViewMode("browse");
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
    isLoading,
    isLoadingNearby,
    nearbyAirports.length,
    originAirport,
    viewMode,
  ]);

  return (
    <div className="flex flex-col h-screen w-full bg-background">
      <div className="flex-none border-b bg-card/50 backdrop-blur-sm z-10">
        <div className="container mx-auto p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl" role="img" aria-label="flight">
                ✈️
              </span>
              <h1 className="text-2xl font-bold tracking-tight">
                Flights Tracker
              </h1>
            </div>
            {authUser ? (
              <Popover open={isProfileOpen} onOpenChange={setIsProfileOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="px-3 gap-2 max-w-[220px]"
                  >
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                    <span className="truncate">
                      {authUser.email ?? "Profile"}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="p-2 space-y-1 min-w-[var(--trigger-width)]"
                  style={{
                    // Ensures popover matches trigger width when Radix data attr is available
                    // Fallback using inline style for browsers without support
                    width: "var(--trigger-width)",
                  }}
                >
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2"
                  >
                    <Link href="/profile">
                      <UserRound className="h-4 w-4" aria-hidden="true" />
                      Profile
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2"
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Sign out
                  </Button>
                </PopoverContent>
              </Popover>
            ) : (
              <Button asChild variant="outline" size="sm" className="px-3">
                <Link href="/login" className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  <span>Login</span>
                </Link>
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
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
                    )}
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
            <Badge variant="secondary" className="hidden sm:flex">
              {airports.length.toLocaleString()} Total Airports
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
        ) : (
          <AirportMap
            airports={displayedAirports}
            originAirport={originAirport}
            destinationAirport={destinationAirport}
            onMapReady={handleMapReady}
            onAirportClick={handleAirportClick}
          />
        )}
      </div>
    </div>
  );
}
