"use client";

import { Loader2, MapPin, Search, X } from "lucide-react";
import { AirportSearch } from "@/components/airport-search";
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
};

export function RouteSearchPanel({
  search,
  header,
  isCollapsed = false,
}: RouteSearchPanelProps) {
  const {
    airports,
    origin,
    destination,
    showDestinationField,
    shouldShowSearchAction,
    isSearchDisabled,
    isSearching,
    onSearch,
    onReset,
  } = search;

  const { displayMessage, isInitialLoading, isLoadingNearby } = header;

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
    <button
      type="button"
      className="flex h-14 w-full items-center gap-2.5 rounded-xl border border-border/50 bg-background/50 px-4 text-left transition-all duration-200 hover:bg-background/80 hover:border-border"
      onClick={onClick}
    >
      <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
        <span className="text-base font-semibold tracking-tight">
          {airportCode}
        </span>
        <span className="truncate text-sm text-muted-foreground">
          {city}, {country}
        </span>
      </div>
      <span className="sr-only">Edit {label} airport</span>
    </button>
  );

  return (
    <div
      className={cn(
        "overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-in-out",
        isCollapsed
          ? "pointer-events-none max-h-0 opacity-0 -translate-y-2 md:hidden"
          : "max-h-[720px] opacity-100 translate-y-0",
      )}
    >
      <div className="space-y-3 rounded-2xl border border-border/40 bg-card/70 p-4 shadow-sm backdrop-blur-md transition-all duration-300">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-1 sm:items-center">
            <div className="flex-1">
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
              <div className="flex-1">
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
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="lg"
                className="h-14 w-full gap-2 sm:w-auto sm:min-w-[160px]"
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
                <span className="font-semibold">
                  {isSearching ? "Searching..." : "Search Flights"}
                </span>
              </Button>
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            "flex items-center justify-between text-sm",
            isCollapsed ? "md:hidden" : "",
          )}
        >
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {(isInitialLoading || isLoadingNearby) && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            {displayMessage}
          </p>
          {shouldShowSearchAction ? (
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Clear</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
