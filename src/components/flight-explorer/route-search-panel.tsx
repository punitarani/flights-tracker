"use client";

import { Loader2, MapPin, Search, X } from "lucide-react";
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
  isCollapsed?: boolean;
  onExpand?: () => void;
};

export function RouteSearchPanel({
  search,
  header,
  isCollapsed = false,
  onExpand,
}: RouteSearchPanelProps) {
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

  const showOriginSummary = Boolean(origin.selectedAirport && !origin.isActive);
  const showDestinationSummary = Boolean(
    destination.selectedAirport && !destination.isActive,
  );

  const routeSummary =
    origin.selectedAirport && destination.selectedAirport
      ? `${origin.selectedAirport.iata} → ${destination.selectedAirport.iata}`
      : origin.selectedAirport
        ? origin.selectedAirport.iata
        : "Select route";

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
      className={cn(
        "h-12 w-full justify-start gap-3 transition-all duration-200",
        isCollapsed
          ? "md:h-10 md:w-auto md:min-w-[100px] md:justify-center md:gap-2"
          : "",
      )}
      onClick={onClick}
    >
      <MapPin className="h-4 w-4 text-primary" />
      <div className="flex flex-col text-left md:flex-row md:items-center md:gap-0">
        <span
          className={cn(
            "text-sm font-semibold",
            isCollapsed ? "md:text-sm" : "",
          )}
        >
          {airportCode}
        </span>
        <span
          className={cn(
            "text-xs text-muted-foreground truncate",
            isCollapsed ? "md:hidden" : "",
          )}
        >
          {city}, {country}
        </span>
      </div>
      <span className="sr-only">Edit {label} airport</span>
    </Button>
  );

  return (
    <div
      className={cn(
        "overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-in-out",
        isCollapsed
          ? "pointer-events-none max-h-0 opacity-0 -translate-y-2 md:pointer-events-auto md:max-h-[640px] md:opacity-100 md:translate-y-0"
          : "max-h-[720px] opacity-100 translate-y-0",
      )}
    >
      <div
        className={cn(
          "space-y-3 rounded-2xl border border-border/40 bg-card/70 p-4 shadow-sm backdrop-blur-md transition-all duration-300",
          isCollapsed ? "md:px-3 md:py-2 md:space-y-0 md:shadow" : "",
        )}
      >
        {isCollapsed && shouldShowSearchAction ? (
          <div className="hidden md:flex items-center justify-between gap-4">
            <button
              type="button"
              className="flex items-center rounded-full border border-border/60 bg-background/95 px-4 py-2 text-sm font-medium shadow-sm backdrop-blur transition-all duration-200 hover:bg-background"
              onClick={onExpand}
            >
              <span>{routeSummary}</span>
            </button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={onReset}
                aria-label="Clear search"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                className="h-10 gap-2 px-4"
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
                <span className="text-sm font-semibold">
                  {isSearching ? "Searching..." : "Search Flights"}
                </span>
              </Button>
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            "flex flex-col gap-3 sm:flex-row sm:items-stretch",
            isCollapsed && shouldShowSearchAction ? "md:hidden" : "",
          )}
        >
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

          {shouldShowSearchAction ? (
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
          ) : null}
        </div>

        <div
          className={cn(
            "flex items-center justify-between text-sm min-h-[20px]",
            isCollapsed ? "md:hidden" : "",
          )}
        >
          <p className="text-muted-foreground flex items-center gap-2">
            {(isInitialLoading || isLoadingNearby) && (
              <Loader2 className="h-3 w-3 animate-spin" />
            )}
            {displayMessage}
          </p>
          {shouldShowSearchAction ? (
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
          ) : onExpand ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-2 text-muted-foreground"
              onClick={onExpand}
            >
              Edit search
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
