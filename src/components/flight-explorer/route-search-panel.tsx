"use client";

import { ChevronDown, Loader2, MapPin, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

  // Mobile collapse state
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const scheduleAttachTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const handleScrollRef = useRef<((event: Event) => void) | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia("(max-width: 767px)");
    const updateIsMobile = () => setIsMobile(media.matches);
    updateIsMobile();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", updateIsMobile);
      return () => media.removeEventListener("change", updateIsMobile);
    }

    media.addListener(updateIsMobile);
    return () => media.removeListener(updateIsMobile);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      if (isCollapsed) setIsCollapsed(false);
      if (isExpanded) setIsExpanded(false);
      return;
    }

    const isFieldActive = origin.isActive || destination.isActive;

    if (isFieldActive) {
      if (!isExpanded) setIsExpanded(true);
      if (isCollapsed) setIsCollapsed(false);
      return;
    }

    if (!shouldShowSearchAction) {
      if (isCollapsed) setIsCollapsed(false);
      if (isExpanded) setIsExpanded(false);
      return;
    }

    if (!isCollapsed && !isExpanded) {
      setIsCollapsed(true);
    }
  }, [
    destination.isActive,
    isCollapsed,
    isExpanded,
    isMobile,
    origin.isActive,
    shouldShowSearchAction,
  ]);

  // Scroll detection for mobile collapse
  useEffect(() => {
    if (!shouldShowSearchAction || !isMobile) {
      setIsCollapsed(false);
      setIsExpanded(false);

      if (scheduleAttachTimeoutRef.current) {
        clearTimeout(scheduleAttachTimeoutRef.current);
        scheduleAttachTimeoutRef.current = null;
      }

      if (scrollContainerRef.current && handleScrollRef.current) {
        scrollContainerRef.current.removeEventListener(
          "scroll",
          handleScrollRef.current,
        );
        scrollContainerRef.current = null;
      }

      if (handleScrollRef.current) {
        window.removeEventListener("scroll", handleScrollRef.current, true);
      }

      return;
    }

    const threshold = 50;
    let lastScrollY = 0;

    const handleScroll = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const currentScrollY = target?.scrollTop ?? window.scrollY;

      if (currentScrollY > threshold && currentScrollY > lastScrollY) {
        setIsCollapsed(true);
        setIsExpanded(false);
      } else if (currentScrollY < threshold) {
        setIsCollapsed(false);
        setIsExpanded(false);
      }

      lastScrollY = currentScrollY;
    };

    handleScrollRef.current = handleScroll;

    const attachToContainer = () => {
      if (scheduleAttachTimeoutRef.current) {
        clearTimeout(scheduleAttachTimeoutRef.current);
        scheduleAttachTimeoutRef.current = null;
      }

      const container = document.getElementById("flight-price-panel-scroll");
      if (!container) {
        return false;
      }

      if (
        scrollContainerRef.current &&
        scrollContainerRef.current !== container &&
        handleScrollRef.current
      ) {
        scrollContainerRef.current.removeEventListener(
          "scroll",
          handleScrollRef.current,
        );
      }

      container.addEventListener("scroll", handleScroll, { passive: true });
      scrollContainerRef.current = container;

      if (handleScrollRef.current) {
        window.removeEventListener("scroll", handleScrollRef.current, true);
      }

      return true;
    };

    if (!attachToContainer()) {
      window.addEventListener("scroll", handleScroll, true);

      const retry = (attempt: number) => {
        if (attachToContainer()) {
          return;
        }

        if (attempt >= 5) {
          return;
        }

        scheduleAttachTimeoutRef.current = setTimeout(
          () => retry(attempt + 1),
          Math.min(100 * 2 ** attempt, 1000),
        );
      };

      retry(0);
    }

    return () => {
      if (scheduleAttachTimeoutRef.current) {
        clearTimeout(scheduleAttachTimeoutRef.current);
        scheduleAttachTimeoutRef.current = null;
      }

      if (scrollContainerRef.current && handleScrollRef.current) {
        scrollContainerRef.current.removeEventListener(
          "scroll",
          handleScrollRef.current,
        );
        scrollContainerRef.current = null;
      }

      if (handleScrollRef.current) {
        window.removeEventListener("scroll", handleScrollRef.current, true);
      }
    };
  }, [shouldShowSearchAction, isMobile]);

  const handlePillClick = () => {
    setIsExpanded(true);
    setIsCollapsed(false);

    // Scroll the container back to top when expanding
    const scrollContainer = document.getElementById(
      "flight-price-panel-scroll",
    );
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const showOriginSummary = Boolean(origin.selectedAirport && !origin.isActive);
  const showDestinationSummary = Boolean(
    destination.selectedAirport && !destination.isActive,
  );

  // Generate pill display text
  const pillText = () => {
    if (origin.selectedAirport && destination.selectedAirport) {
      return `${origin.selectedAirport.iata} → ${destination.selectedAirport.iata}`;
    }
    if (origin.selectedAirport) {
      return `From ${origin.selectedAirport.iata}`;
    }
    return "Search flights";
  };

  // Collapsed pill view for mobile
  const renderCollapsedPill = () => (
    <button
      type="button"
      onClick={handlePillClick}
      className="flex w-full items-center justify-between gap-2 rounded-full bg-card/80 px-4 py-2.5 shadow-md backdrop-blur-sm transition-transform duration-300 ease-out hover:bg-card/90 hover:translate-y-[-1px] active:scale-[0.98]"
    >
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-primary" aria-hidden="true" />
        <span className="text-sm font-medium">{pillText()}</span>
      </div>
      <ChevronDown
        className="h-4 w-4 text-muted-foreground"
        aria-hidden="true"
      />
    </button>
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

  const showCollapsed = isMobile && isCollapsed && !isExpanded;
  const showFullView = !isMobile || !isCollapsed || isExpanded;

  return (
    <div
      className={cn(
        "sticky top-0 z-10 flex-none border-b bg-card/50 backdrop-blur-sm",
        isMobile
          ? cn(
              "transition-[background-color,backdrop-filter,padding] duration-500 ease-in-out",
              showCollapsed ? "pt-2" : "pt-0",
            )
          : "pt-0",
      )}
    >
      {/* Mobile collapsed pill - only visible on mobile when collapsed */}
      <div
        className={cn(
          "container mx-auto px-4 py-2",
          isMobile
            ? cn(
                "transition-[opacity,max-height,transform] duration-500 ease-in-out will-change-[opacity,transform]",
                showCollapsed
                  ? "max-h-16 opacity-100 translate-y-0"
                  : "max-h-0 opacity-0 -translate-y-1 overflow-hidden pointer-events-none",
              )
            : "hidden",
        )}
      >
        {renderCollapsedPill()}
      </div>

      {/* Full search view */}
      <div
        className={cn(
          "container mx-auto space-y-3 transition-[opacity,max-height,transform,padding] duration-500 ease-in-out will-change-[opacity,transform]",
          "md:p-4 md:opacity-100 md:max-h-none", // Always visible on desktop
          showFullView
            ? "max-h-[500px] translate-y-0 p-4 opacity-100"
            : "max-h-0 -translate-y-3 overflow-hidden p-0 opacity-0 pointer-events-none",
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-1 sm:items-stretch">
            <div
              className={cn(
                "transition-[opacity,flex-basis] duration-400 ease-out",
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
                  className="w-full transition-[opacity,transform] duration-300 ease-out"
                />
              )}
            </div>

            {showDestinationField && (
              <div
                className={cn(
                  "transition-[opacity,flex-basis] duration-400 ease-out",
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
                    className="w-full transition-[opacity,transform] duration-300 ease-out"
                  />
                )}
              </div>
            )}
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
