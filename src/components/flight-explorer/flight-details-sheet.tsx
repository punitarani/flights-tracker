"use client";

import { format, parseISO } from "date-fns";
import { ArrowRight, Clock, MapPin, Plane, Ticket, X } from "lucide-react";
import { Fragment, useMemo } from "react";
import { AirportMap } from "@/components/airport-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { SeatsAeroAvailabilityTripModel } from "@/lib/fli/models/seats-aero";
import type { AirportData } from "@/server/services/airports";
import type { FlightOption } from "@/server/services/flights";
import { MILEAGE_FORMATTER } from "./constants";

type FlightDetailsSheetProps = {
  flightOption: FlightOption | null;
  awardTrips: SeatsAeroAvailabilityTripModel[];
  selectedDate: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  airports: AirportData[];
};

type ProgramAwardGroup = {
  source: string;
  awards: Array<{
    cabinClass: "economy" | "premium_economy" | "business" | "first";
    cabinLabel: string;
    mileageCost: number;
    remainingSeats: number;
    totalTaxes: string;
    taxesCurrency: string | null;
  }>;
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

const CABIN_CLASS_LABELS: Record<string, string> = {
  economy: "Economy",
  premium_economy: "Premium Economy",
  business: "Business",
  first: "First",
};

const CABIN_CLASS_ORDER = ["economy", "premium_economy", "business", "first"];

/**
 * Matches flight option to award trips and groups by mileage program
 */
function groupAwardsByProgram(
  flightOption: FlightOption,
  awardTrips: SeatsAeroAvailabilityTripModel[],
): ProgramAwardGroup[] {
  // Extract flight numbers from the option
  const optionFlightNumbers = new Set<string>();
  const optionFlightNumbersWithCode = new Set<string>();

  for (const slice of flightOption.slices) {
    for (const leg of slice.legs) {
      const number = leg.flightNumber.trim().toUpperCase();
      const code = leg.airlineCode.trim().toUpperCase();

      if (number) {
        optionFlightNumbers.add(number);
        if (code) {
          optionFlightNumbersWithCode.add(`${code} ${number}`);
        }
      }
    }
  }

  if (optionFlightNumbers.size === 0) {
    return [];
  }

  // Find matching award trips
  const matchingTrips: SeatsAeroAvailabilityTripModel[] = [];
  for (const trip of awardTrips) {
    const hasMatch = trip.flightNumbers.some((fn) => {
      const normalized = fn.trim().toUpperCase();

      // Try exact match first
      if (optionFlightNumbersWithCode.has(normalized)) {
        return true;
      }

      // Try matching just the number part
      const parts = normalized.split(/\s+/);
      const numericPart = parts[parts.length - 1];
      if (numericPart && optionFlightNumbers.has(numericPart)) {
        return true;
      }

      // Try matching without space
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
    return [];
  }

  // Group by source (mileage program)
  const programMap = new Map<string, ProgramAwardGroup>();

  for (const trip of matchingTrips) {
    if (!programMap.has(trip.source)) {
      programMap.set(trip.source, {
        source: trip.source,
        awards: [],
      });
    }

    const group = programMap.get(trip.source)!;
    group.awards.push({
      cabinClass: trip.cabinClass,
      cabinLabel: CABIN_CLASS_LABELS[trip.cabinClass] || trip.cabinClass,
      mileageCost: trip.mileageCost,
      remainingSeats: trip.remainingSeats,
      totalTaxes: trip.totalTaxes,
      taxesCurrency: trip.taxesCurrency,
    });
  }

  // Sort awards within each program by cabin class order and mileage
  for (const group of programMap.values()) {
    group.awards.sort((a, b) => {
      const orderA = CABIN_CLASS_ORDER.indexOf(a.cabinClass);
      const orderB = CABIN_CLASS_ORDER.indexOf(b.cabinClass);
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.mileageCost - b.mileageCost;
    });
  }

  // Convert to array and sort by lowest mileage in each program
  return Array.from(programMap.values()).sort((a, b) => {
    const minA = Math.min(...a.awards.map((award) => award.mileageCost));
    const minB = Math.min(...b.awards.map((award) => award.mileageCost));
    return minA - minB;
  });
}

export function FlightDetailsSheet({
  flightOption,
  awardTrips,
  selectedDate,
  isOpen,
  onOpenChange,
  airports,
}: FlightDetailsSheetProps) {
  const programGroups = useMemo(() => {
    if (!flightOption) return [];
    return groupAwardsByProgram(flightOption, awardTrips);
  }, [flightOption, awardTrips]);

  const { originAirport, destinationAirport } = useMemo(() => {
    if (!flightOption || flightOption.slices.length === 0) {
      return { originAirport: null, destinationAirport: null };
    }

    const firstLeg = flightOption.slices[0].legs[0];
    const lastSlice = flightOption.slices[flightOption.slices.length - 1];
    const lastLeg = lastSlice.legs[lastSlice.legs.length - 1];

    const origin = airports.find(
      (a) => a.iata === firstLeg.departureAirportCode,
    );
    const destination = airports.find(
      (a) => a.iata === lastLeg.arrivalAirportCode,
    );

    return {
      originAirport: origin || null,
      destinationAirport: destination || null,
    };
  }, [flightOption, airports]);

  if (!flightOption) {
    return null;
  }

  const formattedDate = format(parseISO(selectedDate), "EEEE, MMM d, yyyy");
  const formattedPrice = formatCurrency(
    flightOption.totalPrice,
    flightOption.currency,
  );

  // Get airline names for header
  const airlineNames: string[] = [];
  const seenAirlineNames = new Set<string>();
  for (const slice of flightOption.slices) {
    for (const leg of slice.legs) {
      if (!leg.airlineName || seenAirlineNames.has(leg.airlineName)) {
        continue;
      }
      seenAirlineNames.add(leg.airlineName);
      airlineNames.push(leg.airlineName);
    }
  }
  const headerTitle =
    airlineNames.length > 0 ? airlineNames.join(" + ") : "Flight Details";

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto sm:max-w-2xl"
      >
        <SheetHeader className="flex-row items-center justify-between gap-2 pb-4">
          <SheetTitle className="text-base font-semibold">
            {headerTitle}
          </SheetTitle>
          <SheetClose asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Close</span>
            </Button>
          </SheetClose>
        </SheetHeader>

        <div className="space-y-6">
          {/* Header Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{formattedDate}</p>
              <Badge variant="secondary" className="text-base font-semibold">
                {formattedPrice}
              </Badge>
            </div>
          </div>

          {/* Flight Route Map */}
          {originAirport && destinationAirport && (
            <Card className="overflow-hidden">
              <div className="h-[200px] w-full">
                <AirportMap
                  airports={airports}
                  originAirport={originAirport}
                  destinationAirport={destinationAirport}
                  showAllAirports={false}
                />
              </div>
            </Card>
          )}

          {/* Flight Segments */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Plane className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Flight Details</h3>
            </div>

            {flightOption.slices.map((slice, sliceIndex) => {
              const stopsLabel =
                slice.stops === 0
                  ? "Nonstop"
                  : `${slice.stops} stop${slice.stops > 1 ? "s" : ""}`;
              const durationLabel = formatDuration(slice.durationMinutes);

              return (
                <div key={`slice-${sliceIndex}`} className="space-y-3">
                  {flightOption.slices.length > 1 && (
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                      const legDuration = formatDuration(leg.durationMinutes);

                      return (
                        <Fragment key={`leg-${sliceIndex}-${legIndex}`}>
                          <Card className="p-3">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <p className="text-sm font-semibold">
                                      {leg.departureAirportCode}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {departureTime}
                                    </p>
                                  </div>
                                </div>
                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="text-sm font-semibold text-right">
                                    {leg.arrivalAirportCode}
                                  </p>
                                  <p className="text-xs text-muted-foreground text-right">
                                    {arrivalTime}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between border-t pt-2">
                                <div className="text-xs text-muted-foreground">
                                  <p className="font-medium">
                                    {leg.airlineCode} {leg.flightNumber}
                                  </p>
                                  <p>{leg.airlineName}</p>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {legDuration}
                                </p>
                              </div>
                            </div>
                          </Card>
                          {legIndex < slice.legs.length - 1 && (
                            <div className="pl-3 text-xs text-muted-foreground">
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

          {/* Award Availability */}
          {programGroups.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Award Availability</h3>
              </div>

              <div className="space-y-3">
                {programGroups.map((program, index) => (
                  <Card key={`${program.source}-${index}`} className="p-4">
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold">
                        {program.source}
                      </h4>
                      <div className="space-y-2">
                        {program.awards.map((award, awardIndex) => (
                          <div
                            key={`${award.cabinClass}-${awardIndex}`}
                            className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {award.cabinLabel}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {award.remainingSeats} seat
                                {award.remainingSeats !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold">
                                {MILEAGE_FORMATTER.format(award.mileageCost)}{" "}
                                miles
                              </p>
                              {award.totalTaxes && (
                                <p className="text-xs text-muted-foreground">
                                  +{" "}
                                  {formatCurrency(
                                    Number.parseFloat(award.totalTaxes),
                                    award.taxesCurrency || "USD",
                                  )}{" "}
                                  taxes
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {programGroups.length === 0 && (
            <div className="rounded-lg border border-dashed bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
              No award availability found for this flight.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
