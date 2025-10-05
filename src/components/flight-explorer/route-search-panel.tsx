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

  const {
    displayMessage,
    isInitialLoading,
    isLoadingNearby,
    totalAirports,
    onShowAllAirports,
  } = header;

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
    <div className="flex-none border-b bg-card/50 backdrop-blur-sm z-10">
      <div className="container mx-auto p-4 space-y-3">
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

          {shouldShowSearchAction && (
            <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:items-center sm:justify-end">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12 shrink-0"
                  onClick={onReset}
                  aria-label="Reset search"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">Reset</span>
                </Button>
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
          <Badge
            asChild
            variant="secondary"
            className="hidden sm:flex cursor-pointer"
          >
            <button
              type="button"
              onClick={onShowAllAirports}
              className="flex items-center gap-1"
              aria-label="Show all airports worldwide"
            >
              Support {totalAirports.toLocaleString()} Total Airports
            </button>
          </Badge>
        </div>
      </div>
    </div>
  );
}
