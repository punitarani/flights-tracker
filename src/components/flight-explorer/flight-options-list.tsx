"use client";

import { format, parseISO } from "date-fns";
import { ArrowRight, Clock, Plane } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { SeatsAeroAvailabilityTripModel } from "@/lib/fli/models/seats-aero";
import type { AirportData } from "@/server/services/airports";
import type { FlightOption } from "@/server/services/flights";
import { MILEAGE_FORMATTER } from "./constants";
import { FlightDetailsSheet } from "./flight-details-sheet";

type FlightOptionsListProps = {
  options: FlightOption[];
  selectedDate: string | null;
  isLoading: boolean;
  error: string | null;
  awardTrips: SeatsAeroAvailabilityTripModel[];
  airports: AirportData[];
};

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours === 0) {
    return `${remaining}m`;
  }
  if (remaining === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remaining}m`;
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

type AwardMatch = {
  economy: number | null;
  business: number | null;
  first: number | null;
  premiumEconomy: number | null;
};

/**
 * Matches a flight option to award trips by flight numbers
 * Returns the lowest mileage cost per cabin class
 */
function matchFlightToAwardTrips(
  option: FlightOption,
  awardTrips: SeatsAeroAvailabilityTripModel[],
): AwardMatch | null {
  // Extract all flight numbers from all legs in all slices
  // Store both with and without airline code for flexible matching
  const optionFlightNumbers = new Set<string>();
  const optionFlightNumbersWithCode = new Set<string>();

  for (const slice of option.slices) {
    for (const leg of slice.legs) {
      const number = leg.flightNumber.trim().toUpperCase();
      const code = leg.airlineCode.trim().toUpperCase();

      if (number) {
        optionFlightNumbers.add(number);
        // Also store with airline code (e.g., "F9 3549")
        if (code) {
          optionFlightNumbersWithCode.add(`${code} ${number}`);
        }
      }
    }
  }

  if (optionFlightNumbers.size === 0) {
    return null;
  }

  // Find matching award trips
  const matchingTrips: SeatsAeroAvailabilityTripModel[] = [];
  for (const trip of awardTrips) {
    // Check if any flight numbers match
    const hasMatch = trip.flightNumbers.some((fn) => {
      const normalized = fn.trim().toUpperCase();

      // Try exact match first (e.g., "F9 3549" === "F9 3549")
      if (optionFlightNumbersWithCode.has(normalized)) {
        return true;
      }

      // Try matching just the number part (e.g., "F9 3549" contains "3549")
      // Extract just the numeric part from award flight number
      const parts = normalized.split(/\s+/);
      const numericPart = parts[parts.length - 1];
      if (numericPart && optionFlightNumbers.has(numericPart)) {
        return true;
      }

      // Try matching without space (e.g., "F93549" === "F93549")
      const noSpace = normalized.replace(/\s+/g, "");
      for (const code of optionFlightNumbersWithCode) {
        if (code.replace(/\s+/g, "") === noSpace) {
          return true;
        }
      }

      return false;
    });

    if (hasMatch) {
      matchingTrips.push(trip);
    }
  }

  if (matchingTrips.length === 0) {
    return null;
  }

  // Group by cabin class and find lowest mileage
  const match: AwardMatch = {
    economy: null,
    business: null,
    first: null,
    premiumEconomy: null,
  };

  for (const trip of matchingTrips) {
    switch (trip.cabinClass) {
      case "economy":
        match.economy =
          match.economy === null
            ? trip.mileageCost
            : Math.min(match.economy, trip.mileageCost);
        break;
      case "business":
        match.business =
          match.business === null
            ? trip.mileageCost
            : Math.min(match.business, trip.mileageCost);
        break;
      case "first":
        match.first =
          match.first === null
            ? trip.mileageCost
            : Math.min(match.first, trip.mileageCost);
        break;
      case "premium_economy":
        match.premiumEconomy =
          match.premiumEconomy === null
            ? trip.mileageCost
            : Math.min(match.premiumEconomy, trip.mileageCost);
        break;
    }
  }

  // Return null if no cabin classes have matches
  if (
    match.economy === null &&
    match.business === null &&
    match.first === null &&
    match.premiumEconomy === null
  ) {
    return null;
  }

  return match;
}

export function FlightOptionsList({
  options,
  selectedDate,
  isLoading,
  error,
  awardTrips,
  airports,
}: FlightOptionsListProps) {
  const [selectedFlight, setSelectedFlight] = useState<FlightOption | null>(
    null,
  );
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const skeletonPlaceholders = [
    "loading-option-1",
    "loading-option-2",
    "loading-option-3",
  ] as const;

  // Match each flight option to award trips
  const awardMatches = useMemo(() => {
    return options.map((option) => matchFlightToAwardTrips(option, awardTrips));
  }, [options, awardTrips]);

  const handleFlightClick = (option: FlightOption) => {
    setSelectedFlight(option);
    setIsSheetOpen(true);
  };

  if (!selectedDate) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
        Select a date above to view detailed flight options.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {skeletonPlaceholders.map((key) => (
          <Skeleton key={key} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {error}
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
        No flight options found for{" "}
        {format(parseISO(selectedDate), "MMM d, yyyy")}.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {options.map((option, optionIndex) => {
          const formattedPrice = formatCurrency(
            option.totalPrice,
            option.currency,
          );
          const airlineNames: string[] = [];
          const seenAirlineNames = new Set<string>();
          for (const slice of option.slices) {
            for (const leg of slice.legs) {
              if (!leg.airlineName || seenAirlineNames.has(leg.airlineName)) {
                continue;
              }
              seenAirlineNames.add(leg.airlineName);
              airlineNames.push(leg.airlineName);
            }
          }
          const headerTitle =
            airlineNames.length > 0
              ? airlineNames.join(" + ")
              : `Option ${optionIndex + 1}`;
          const awardMatch = awardMatches[optionIndex];
          return (
            <div
              key={`${option.totalPrice}-${optionIndex}`}
              onClick={() => handleFlightClick(option)}
              className="cursor-pointer rounded-lg border bg-card/80 p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/50"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold">{headerTitle}</p>
                <div className="flex flex-wrap gap-2">
                  {awardMatch && (
                    <div className="flex flex-wrap gap-1.5">
                      {awardMatch.economy !== null && (
                        <Badge
                          variant="outline"
                          className="w-fit whitespace-nowrap text-xs"
                        >
                          Economy:{" "}
                          {MILEAGE_FORMATTER.format(awardMatch.economy)}
                        </Badge>
                      )}
                      {awardMatch.premiumEconomy !== null && (
                        <Badge
                          variant="outline"
                          className="w-fit whitespace-nowrap text-xs"
                        >
                          Premium:{" "}
                          {MILEAGE_FORMATTER.format(awardMatch.premiumEconomy)}
                        </Badge>
                      )}
                      {awardMatch.business !== null && (
                        <Badge
                          variant="outline"
                          className="w-fit whitespace-nowrap text-xs"
                        >
                          Business:{" "}
                          {MILEAGE_FORMATTER.format(awardMatch.business)}
                        </Badge>
                      )}
                      {awardMatch.first !== null && (
                        <Badge
                          variant="outline"
                          className="w-fit whitespace-nowrap text-xs"
                        >
                          First: {MILEAGE_FORMATTER.format(awardMatch.first)}
                        </Badge>
                      )}
                    </div>
                  )}
                  <Badge
                    variant="secondary"
                    className="w-fit whitespace-nowrap"
                  >
                    {formattedPrice}
                  </Badge>
                </div>
              </div>

              <div className="mt-3 space-y-4">
                {option.slices.map((slice, sliceIndex) => {
                  const stopsLabel =
                    slice.stops === 0
                      ? "Nonstop"
                      : `${slice.stops} stop${slice.stops > 1 ? "s" : ""}`;
                  const durationLabel = formatDuration(slice.durationMinutes);

                  return (
                    <div
                      key={`${slice.durationMinutes}-${sliceIndex}`}
                      className="space-y-2"
                    >
                      {option.slices.length > 1 && (
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <Plane className="h-3 w-3" aria-hidden="true" />
                          Segment {sliceIndex + 1}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {durationLabel}
                        </span>
                        <span>•</span>
                        <span>{stopsLabel}</span>
                      </div>
                      <div className="space-y-3">
                        {slice.legs.map((leg, legIndex) => {
                          const departureTime = format(
                            parseISO(leg.departureDateTime),
                            "MMM d • h:mm a",
                          );
                          const arrivalTime = format(
                            parseISO(leg.arrivalDateTime),
                            "MMM d • h:mm a",
                          );
                          return (
                            <Fragment key={`${leg.flightNumber}-${legIndex}`}>
                              <div className="flex flex-col gap-2 rounded-md border bg-background/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                                  <div className="flex flex-col">
                                    <span className="text-sm font-semibold">
                                      {leg.departureAirportCode}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {departureTime}
                                    </span>
                                  </div>
                                  <ArrowRight
                                    className="hidden h-4 w-4 sm:block"
                                    aria-hidden="true"
                                  />
                                  <div className="flex flex-col sm:items-end">
                                    <span className="text-sm font-semibold">
                                      {leg.arrivalAirportCode}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {arrivalTime}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-xs text-muted-foreground sm:text-right">
                                  {leg.airlineCode} {leg.flightNumber}
                                  <div className="leading-tight">
                                    {leg.airlineName}
                                  </div>
                                </div>
                              </div>
                              {legIndex < slice.legs.length - 1 && (
                                <div className="pl-3 text-[11px] text-muted-foreground">
                                  Layover at {leg.arrivalAirportName}
                                </div>
                              )}
                            </Fragment>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <FlightDetailsSheet
        flightOption={selectedFlight}
        awardTrips={awardTrips}
        selectedDate={selectedDate}
        isOpen={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        airports={airports}
      />
    </>
  );
}
