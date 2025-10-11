"use client";

import { Loader2, MapPin, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AirportSearch } from "@/components/airport-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  FlightExplorerHeaderState,
  FlightExplorerSearchState,
} from "@/hooks/use-flight-explorer";
import { cn } from "@/lib/utils";

type RouteSearchPanelProps = {
  search: FlightExplorerSearchState;
  header: FlightExplorerHeaderState;
};

const MOBILE_BREAKPOINT = 768;
const COLLAPSE_SCROLL_OFFSET = 96;
const SCROLL_DELTA_THRESHOLD = 6;

export function RouteSearchPanel({ search, header }: RouteSearchPanelProps) {
  const {
    airports,
    origin,
    destination,
    showDestinationField,
    isEditing,
    shouldShowSearchAction,
    isSearchDisabled,
    isSearching,
    onSearch,
    onReset,
    routeChangedSinceSearch,
  } = search;

  const { displayMessage, isInitialLoading, isLoadingNearby } = header;

  const [isCollapsed, setIsCollapsed] = useState(false);
  const collapseStateRef = useRef(false);
  const lastScrollYRef = useRef(0);

  const updateCollapsedState = useCallback((next: boolean) => {
    if (collapseStateRef.current === next) {
      return;
    }
    collapseStateRef.current = next;
    setIsCollapsed(next);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    lastScrollYRef.current = window.scrollY;

    const handleScroll = () => {
      if (typeof window === "undefined") {
        return;
      }

      const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
      if (!isMobile) {
        if (collapseStateRef.current) {
          updateCollapsedState(false);
        }
        lastScrollYRef.current = window.scrollY;
        return;
      }

      const currentY = window.scrollY;
      const lastY = lastScrollYRef.current;
      const delta = currentY - lastY;

      if (currentY < COLLAPSE_SCROLL_OFFSET) {
        updateCollapsedState(false);
      } else if (delta > SCROLL_DELTA_THRESHOLD) {
        updateCollapsedState(true);
      } else if (delta < -SCROLL_DELTA_THRESHOLD) {
        updateCollapsedState(false);
      }

      lastScrollYRef.current = currentY;
    };

    const handleResize = () => {
      if (typeof window === "undefined") {
        return;
      }

      if (window.innerWidth >= MOBILE_BREAKPOINT) {
        updateCollapsedState(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [updateCollapsedState]);

  useEffect(() => {
    if (!origin.selectedAirport || !destination.selectedAirport) {
      updateCollapsedState(false);
    }
  }, [
    destination.selectedAirport,
    origin.selectedAirport,
    updateCollapsedState,
  ]);

  useEffect(() => {
    if (isEditing) {
      updateCollapsedState(false);
    }
  }, [isEditing, updateCollapsedState]);

  const collapsedRouteLabel = useMemo(() => {
    const originAirport = origin.selectedAirport;
    const destinationAirport = destination.selectedAirport;

    const originCode = originAirport?.iata?.toUpperCase();
    const destinationCode = destinationAirport?.iata?.toUpperCase();

    if (originCode && destinationCode) {
      return `${originCode} → ${destinationCode}`;
    }

    if (originCode) {
      return `${originCode} • Choose destination`;
    }

    return "Search flights";
  }, [destination.selectedAirport, origin.selectedAirport]);

  const collapsedRouteDescription = useMemo(() => {
    const originAirport = origin.selectedAirport;
    const destinationAirport = destination.selectedAirport;

    const describe = (airport: typeof originAirport) => {
      if (!airport) {
        return "";
      }
      const parts = [airport.city, airport.country]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value && value.length > 0));
      if (parts.length > 0) {
        return parts.join(", ");
      }
      return airport.name ?? "";
    };

    if (originAirport && destinationAirport) {
      const originDescription = describe(originAirport);
      const destinationDescription = describe(destinationAirport);
      if (originDescription && destinationDescription) {
        return `${originDescription} • ${destinationDescription}`;
      }
      return originDescription || destinationDescription || displayMessage;
    }

    if (originAirport) {
      const description = describe(originAirport);
      return description || displayMessage;
    }

    return displayMessage;
  }, [destination.selectedAirport, origin.selectedAirport, displayMessage]);

  const handleCollapsedInteraction = useCallback(() => {
    updateCollapsedState(false);
    if (
      typeof window !== "undefined" &&
      window.innerWidth < MOBILE_BREAKPOINT
    ) {
      window.requestAnimationFrame(() => {
        origin.onActivate();
      });
      return;
    }
    origin.onActivate();
  }, [origin, updateCollapsedState]);

  const showOriginSummary = Boolean(origin.selectedAirport && !origin.isActive);
  const showDestinationSummary = Boolean(
    destination.selectedAirport && !destination.isActive,
  );

  const renderSummaryButton = (
    label: "origin" | "destination",
    onClick: () => void,
    _airportName: string,
    airportCode: string,
    city: string,
    country: string,
  ) => (
    <Button
      type="button"
      variant="outline"
      className="h-12 w-full justify-start gap-3 transition-all duration-200"
      onClick={onClick}
    >
      <MapPin className="h-4 w-4 text-primary" />
      <div className="flex flex-col text-left">
        <span className="text-sm font-semibold">{airportCode}</span>
        <span className="text-xs text-muted-foreground truncate">
          {city}, {country}
        </span>
      </div>
      <span className="sr-only">Edit {label} airport</span>
    </Button>
  );

  return (
    <div
      className={cn(
        "sticky top-0 z-30 flex-none border-b bg-card/60 backdrop-blur-md transition-shadow duration-300",
        isCollapsed
          ? "shadow-[0_16px_32px_-24px_rgba(15,23,42,0.55)]"
          : "shadow-none",
      )}
    >
      <div className="container mx-auto space-y-3 px-4 py-3 sm:py-4">
        <div
          className={cn(
            "md:hidden overflow-hidden transition-[max-height,opacity,transform] duration-200 ease-out",
            isCollapsed
              ? "max-h-24 translate-y-0 opacity-100"
              : "pointer-events-none max-h-0 -translate-y-2 opacity-0",
          )}
        >
          <button
            type="button"
            onClick={handleCollapsedInteraction}
            className="flex w-full items-center justify-between gap-3 rounded-full border border-border/40 bg-background/95 px-4 py-3 text-left shadow-lg backdrop-blur"
            aria-expanded={!isCollapsed}
            aria-label="Expand search panel"
          >
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold text-foreground">
                {collapsedRouteLabel}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {collapsedRouteDescription}
              </span>
            </div>
            <Search
              className="h-4 w-4 shrink-0 text-primary"
              aria-hidden="true"
            />
          </button>
        </div>

        <div
          className={cn(
            "space-y-3 transition-[max-height,opacity,transform] duration-200 ease-in-out",
            isCollapsed
              ? "pointer-events-none max-h-0 -translate-y-1 overflow-hidden opacity-0 md:pointer-events-auto md:max-h-none md:translate-y-0 md:opacity-100"
              : "pointer-events-auto max-h-[1200px] translate-y-0 opacity-100",
          )}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-1 sm:items-stretch">
              <div
                className={cn(
                  "transition-all duration-200 ease-in-out",
                  showOriginSummary ? "sm:w-60" : "sm:flex-1",
                  origin.isActive
                    ? "opacity-100"
                    : origin.selectedAirport
                      ? "opacity-90"
                      : "opacity-100",
                )}
              >
                {showOriginSummary && origin.selectedAirport ? (
                  renderSummaryButton(
                    "origin",
                    origin.onActivate,
                    origin.selectedAirport.name,
                    origin.selectedAirport.iata,
                    origin.selectedAirport.city,
                    origin.selectedAirport.country,
                  )
                ) : (
                  <AirportSearch
                    airports={airports}
                    value={origin.value}
                    onChange={origin.onChange}
                    onSelect={origin.onSelect}
                    onFocus={origin.onActivate}
                    onBlur={origin.onBlur}
                    placeholder="Search origin airport..."
                    inputAriaLabel="Search origin airport"
                    autoFocus
                    isLoading={isInitialLoading}
                    className="w-full transition-all duration-200 ease-in-out"
                  />
                )}
              </div>

              {showDestinationField && (
                <div
                  className={cn(
                    "transition-all duration-200 ease-in-out",
                    showDestinationSummary ? "sm:w-60" : "sm:flex-1",
                    destination.isActive
                      ? "opacity-100"
                      : destination.selectedAirport
                        ? "opacity-90"
                        : "opacity-75",
                  )}
                >
                  {showDestinationSummary && destination.selectedAirport ? (
                    renderSummaryButton(
                      "destination",
                      destination.onActivate,
                      destination.selectedAirport.name,
                      destination.selectedAirport.iata,
                      destination.selectedAirport.city,
                      destination.selectedAirport.country,
                    )
                  ) : (
                    <AirportSearch
                      airports={airports}
                      value={destination.value}
                      onChange={destination.onChange}
                      onSelect={destination.onSelect}
                      onFocus={destination.onActivate}
                      onBlur={destination.onBlur}
                      placeholder="Add destination airport..."
                      inputAriaLabel="Search destination airport"
                      autoFocus={
                        destination.isActive || !destination.selectedAirport
                      }
                      isLoading={isInitialLoading}
                      className="w-full transition-all duration-200 ease-in-out"
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {shouldShowSearchAction && (
            <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:items-center sm:justify-end">
              <div className="flex gap-2">
                <Button
                  type="button"
                  className={cn(
                    "h-12 flex-1 justify-center gap-2",
                    "sm:flex-none sm:w-auto sm:px-4",
                    isEditing ? "sm:w-12 sm:px-0 sm:gap-0" : "",
                  )}
                  disabled={isSearchDisabled}
                  onClick={onSearch}
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
              {routeChangedSinceSearch && !isSearching ? (
                <Badge
                  variant="secondary"
                  className="self-start px-2 py-1 text-[10px] uppercase sm:self-auto"
                >
                  Route updated
                </Badge>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-sm min-h-[20px]">
          <p className="text-muted-foreground flex items-center gap-2">
            {(isInitialLoading || isLoadingNearby) && (
              <Loader2 className="h-3 w-3 animate-spin" />
            )}
            {displayMessage}
          </p>
          {shouldShowSearchAction && (
            <Badge asChild variant="secondary" className="cursor-pointer">
              <button
                type="button"
                onClick={onReset}
                className="flex items-center gap-1"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" aria-hidden="true" />
                Clear
              </button>
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
