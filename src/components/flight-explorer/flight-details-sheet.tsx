"use client";

import { format, parseISO } from "date-fns";
import { ArrowRight, Clock, MapPin, Plane, Ticket, X } from "lucide-react";
import { Fragment, useMemo } from "react";
import { AirportMap } from "@/components/airport-map";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
    let group = programMap.get(trip.source);
    if (!group) {
      group = {
        source: trip.source,
        awards: [],
      };
      programMap.set(trip.source, group);
    }

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
  const firstSlice = flightOption.slices[0];
  const firstSliceFirstLeg = firstSlice.legs[0];
  const lastSlice = flightOption.slices[flightOption.slices.length - 1];
  const lastSliceLastLeg = lastSlice.legs[lastSlice.legs.length - 1];

  const departureDateTime = parseISO(firstSliceFirstLeg.departureDateTime);
  const arrivalDateTime = parseISO(lastSliceLastLeg.arrivalDateTime);

  const routeLabel = `${firstSliceFirstLeg.departureAirportCode} → ${lastSliceLastLeg.arrivalAirportCode}`;
  const departureLabel = format(departureDateTime, "EEE, MMM d • h:mm a");
  const arrivalLabel = format(arrivalDateTime, "EEE, MMM d • h:mm a");
  const departureShort = format(departureDateTime, "h:mm a");
  const arrivalShort = format(arrivalDateTime, "h:mm a");

  const totalDurationMinutes = flightOption.slices.reduce(
    (total, slice) => total + slice.durationMinutes,
    0,
  );
  const totalStops = flightOption.slices.reduce(
    (total, slice) => total + slice.stops,
    0,
  );
  const totalLegs = flightOption.slices.reduce(
    (total, slice) => total + slice.legs.length,
    0,
  );

  const totalStopsLabel =
    totalStops === 0
      ? "Nonstop"
      : `${totalStops} stop${totalStops > 1 ? "s" : ""}`;

  const summaryMetrics = [
    {
      label: "Total duration",
      value: formatDuration(totalDurationMinutes),
      icon: Clock,
    },
    {
      label: "Stops",
      value: totalStopsLabel,
      icon: MapPin,
    },
    {
      label: "Segments",
      value: `${totalLegs} leg${totalLegs > 1 ? "s" : ""}`,
      icon: Plane,
    },
  ];

  const originDisplayCity =
    originAirport?.city ?? firstSliceFirstLeg.departureAirportName;
  const destinationDisplayCity =
    destinationAirport?.city ?? lastSliceLastLeg.arrivalAirportName;

  const originMapLabel = originAirport
    ? [originAirport.city, originAirport.country].filter(Boolean).join(", ")
    : originDisplayCity;
  const destinationMapLabel = destinationAirport
    ? [destinationAirport.city, destinationAirport.country]
        .filter(Boolean)
        .join(", ")
    : destinationDisplayCity;

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-hidden bg-background/95 sm:max-w-3xl [&>[data-slot=sheet-close]]:hidden"
      >
        <SheetHeader className="flex flex-col gap-4 border-b border-border/40 px-6 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                {formattedDate}
              </p>
              <SheetTitle className="text-2xl font-semibold tracking-tight">
                {routeLabel}
              </SheetTitle>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{departureLabel}</span>
                <span aria-hidden="true">→</span>
                <span>{arrivalLabel}</span>
              </div>
              {airlineNames.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground">
                  {airlineNames.map((name) => (
                    <Badge
                      key={name}
                      variant="outline"
                      className="rounded-full border-border/50 px-3 py-1 text-xs"
                    >
                      {name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-start justify-end gap-3">
              <Badge className="rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
                {formattedPrice}
              </Badge>
              <SheetClose asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="mt-0.5 h-9 w-9 rounded-full border border-border/40 bg-muted/30 backdrop-blur transition hover:bg-muted/50"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">Close</span>
                </Button>
              </SheetClose>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-12 pt-6">
          <div className="space-y-8">
            <Card className="rounded-2xl border border-border/50 bg-card/60 px-6 py-6 shadow-[0_24px_80px_-60px_rgba(15,23,42,0.8)] backdrop-blur">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">
                          Departure
                        </p>
                        <p className="text-lg font-semibold text-foreground">
                          {firstSliceFirstLeg.departureAirportCode}
                          <span className="ml-2 text-sm text-muted-foreground">
                            {departureShort}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {originDisplayCity}
                        </p>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <ArrowRight
                          className="h-5 w-5 text-primary"
                          aria-hidden="true"
                        />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">
                          Arrival
                        </p>
                        <p className="text-lg font-semibold text-foreground">
                          {lastSliceLastLeg.arrivalAirportCode}
                          <span className="ml-2 text-sm text-muted-foreground">
                            {arrivalShort}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {destinationDisplayCity}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Separator className="border-border/60" />
                  <div className="grid gap-4 sm:grid-cols-3">
                    {summaryMetrics.map(({ label, value, icon: Icon }) => (
                      <div
                        key={label}
                        className="flex items-center gap-3 rounded-xl border border-border/40 bg-background/60 px-3 py-2.5 text-sm"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                          <Icon
                            className="h-4 w-4 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                            {label}
                          </p>
                          <p className="font-semibold text-foreground">
                            {value}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-border/40 bg-muted/20 p-4 text-sm leading-relaxed text-muted-foreground">
                  <p>
                    Track this itinerary to monitor schedule changes, award
                    space, and pricing variations. Segment data updates in near
                    real-time as we refresh flight availability.
                  </p>
                </div>
              </div>
            </Card>

            {originAirport && destinationAirport && (
              <Card className="overflow-hidden rounded-2xl border border-border/50 bg-card/60 shadow-[0_24px_80px_-60px_rgba(15,23,42,0.8)]">
                <div className="relative">
                  <AspectRatio ratio={16 / 9}>
                    <AirportMap
                      airports={airports}
                      originAirport={originAirport}
                      destinationAirport={destinationAirport}
                      showAllAirports={false}
                    />
                  </AspectRatio>
                  <div className="pointer-events-none absolute inset-x-5 bottom-5 flex flex-wrap items-center gap-3 text-[11px] font-medium">
                    <div className="pointer-events-auto rounded-full bg-background/95 px-4 py-1.5 shadow">
                      {originMapLabel}
                    </div>
                    <div className="pointer-events-auto rounded-full bg-background/95 px-4 py-1.5 shadow">
                      {destinationMapLabel}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <Plane className="h-4 w-4 text-primary" aria-hidden="true" />
                <h3 className="text-base font-semibold">Itinerary breakdown</h3>
              </div>

              <div className="space-y-5">
                {flightOption.slices.map((slice, sliceIndex) => {
                  const sliceKey =
                    slice.legs
                      .map(
                        (leg) =>
                          `${leg.airlineCode}${leg.flightNumber}-${leg.departureDateTime}`,
                      )
                      .join("|") || `slice-${sliceIndex}`;
                  const stopsLabel =
                    slice.stops === 0
                      ? "Nonstop"
                      : `${slice.stops} stop${slice.stops > 1 ? "s" : ""}`;
                  const durationLabel = formatDuration(slice.durationMinutes);

                  return (
                    <Card
                      key={sliceKey}
                      className="rounded-2xl border border-border/50 bg-card/60 px-5 py-6 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                            {sliceIndex + 1}
                          </span>
                          Segment {sliceIndex + 1}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                            {durationLabel}
                          </span>
                          <span className="hidden text-muted-foreground/50 sm:inline">
                            •
                          </span>
                          <span>{stopsLabel}</span>
                        </div>
                      </div>

                      <div className="mt-6 space-y-6">
                        {slice.legs.map((leg, legIndex) => {
                          const legKey = `${leg.airlineCode}${leg.flightNumber}-${leg.departureDateTime}`;
                          const departureTime = format(
                            parseISO(leg.departureDateTime),
                            "MMM d • h:mm a",
                          );
                          const arrivalTime = format(
                            parseISO(leg.arrivalDateTime),
                            "MMM d • h:mm a",
                          );
                          const legDuration = formatDuration(
                            leg.durationMinutes,
                          );

                          const isLastLeg = legIndex === slice.legs.length - 1;

                          return (
                            <Fragment key={legKey}>
                              <div className="grid gap-4 sm:grid-cols-[auto_1fr_auto]">
                                <div className="relative flex flex-col items-center">
                                  <span className="relative z-10 mt-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground" />
                                  {!isLastLeg && (
                                    <span
                                      className="absolute top-3 left-1/2 h-full w-px -translate-x-1/2 bg-border"
                                      aria-hidden="true"
                                    />
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <p className="text-sm font-semibold text-foreground">
                                    {leg.departureAirportCode}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {departureTime}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {leg.departureAirportName}
                                  </p>
                                </div>
                                <div className="space-y-1 text-right">
                                  <p className="text-sm font-semibold text-foreground">
                                    {leg.arrivalAirportCode}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {arrivalTime}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {leg.arrivalAirportName}
                                  </p>
                                </div>
                                <div className="sm:col-span-3 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                                  <div className="font-medium">
                                    {leg.airlineCode} {leg.flightNumber} •{" "}
                                    {leg.airlineName}
                                  </div>
                                  <div className="font-semibold">
                                    {legDuration}
                                  </div>
                                </div>
                              </div>

                              {!isLastLeg && (
                                <div className="ml-7 text-xs text-muted-foreground">
                                  Layover at {leg.arrivalAirportName}
                                </div>
                              )}
                            </Fragment>
                          );
                        })}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>

            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-primary" aria-hidden="true" />
                <h3 className="text-base font-semibold">Award availability</h3>
              </div>

              {programGroups.length > 0 ? (
                <div className="space-y-4">
                  {programGroups.map((program) => {
                    const topAward = program.awards[0];

                    return (
                      <Card
                        key={program.source}
                        className="rounded-2xl border border-border/50 bg-card/60 px-5 py-5 shadow-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div>
                            <h4 className="text-sm font-semibold text-foreground">
                              {program.source}
                            </h4>
                            {topAward ? (
                              <p className="text-xs text-muted-foreground">
                                Best rate{" "}
                                {MILEAGE_FORMATTER.format(topAward.mileageCost)}{" "}
                                miles in {topAward.cabinLabel}
                              </p>
                            ) : null}
                          </div>
                          {topAward ? (
                            <Badge
                              variant="secondary"
                              className="rounded-full border-border/40 bg-muted/40 px-3 py-1 text-xs font-semibold"
                            >
                              Top pick
                            </Badge>
                          ) : null}
                        </div>

                        <div className="mt-4 space-y-3">
                          {program.awards.map((award) => {
                            const awardKey = `${award.cabinClass}-${award.mileageCost}-${award.remainingSeats}`;

                            return (
                              <div
                                key={awardKey}
                                className="grid gap-3 rounded-xl border border-border/40 bg-background/60 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]"
                              >
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant="outline"
                                      className="rounded-full px-2.5 py-1 text-xs"
                                    >
                                      {award.cabinLabel}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {award.remainingSeats} seat
                                      {award.remainingSeats !== 1 ? "s" : ""}{" "}
                                      remaining
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Redeem with {program.source} miles
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-semibold text-foreground">
                                    {MILEAGE_FORMATTER.format(
                                      award.mileageCost,
                                    )}{" "}
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
                            );
                          })}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/50 bg-muted/40 px-6 py-7 text-center text-sm text-muted-foreground">
                  No partner award availability is currently published for this
                  flight. Check back soon as award space can change frequently.
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
