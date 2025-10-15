"use client";

import { format, parseISO } from "date-fns";
import { ArrowRight, Clock, MapPin, Plane, Ticket } from "lucide-react";
import { useMemo } from "react";
import { AirportMap } from "@/components/airport-map";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Sheet,
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

function _parseAmountToCents(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    if (Number.isNaN(value)) {
      return null;
    }
    return Math.round(value);
  }

  const cleaned = value.replace(/,/g, "").trim();
  if (cleaned.length === 0) {
    return null;
  }

  if (cleaned.includes(".")) {
    const parsed = Number.parseFloat(cleaned);
    if (Number.isNaN(parsed)) {
      return null;
    }
    return Math.round(parsed * 100);
  }

  const parsed = Number.parseInt(cleaned, 10);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
}

const CABIN_CLASS_LABELS: Record<string, string> = {
  economy: "Economy",
  premium_economy: "Premium Economy",
  business: "Business",
  first: "First",
};

const CABIN_CLASS_ORDER = ["economy", "premium_economy", "business", "first"];

function toTitleCase(value?: string | null) {
  if (!value) return "";

  return value
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

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
      const normalizedName = leg.airlineName?.trim();
      if (!normalizedName) {
        continue;
      }

      const uppercaseName = normalizedName.toUpperCase();
      if (seenAirlineNames.has(uppercaseName)) {
        continue;
      }
      seenAirlineNames.add(uppercaseName);
      airlineNames.push(toTitleCase(normalizedName));
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
  const legsLabel = `${totalLegs} leg${totalLegs === 1 ? "" : "s"}`;

  const totalStopsLabel =
    totalStops === 0
      ? "Nonstop"
      : `${totalStops} stop${totalStops > 1 ? "s" : ""}`;

  const summaryMetrics = [
    {
      label: "Duration",
      value: formatDuration(totalDurationMinutes),
      icon: Clock,
    },
    {
      label: "Stops",
      value: totalStopsLabel,
      icon: MapPin,
    },
    {
      label: "Legs",
      value: legsLabel,
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
        className="w-full gap-0 overflow-hidden bg-background sm:max-w-3xl"
      >
        <SheetHeader className="flex flex-col gap-4 border-b border-border/40 px-6 py-6 sm:pr-14">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
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
            </div>

            <div className="flex flex-col items-start gap-2 text-xs font-medium text-muted-foreground sm:items-end">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                {formattedPrice}
                <span className="ml-2 text-xs font-medium uppercase tracking-wide text-primary/80">
                  Total
                </span>
              </span>
              {airlineNames.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {airlineNames.map((name) => (
                    <Badge
                      key={name}
                      variant="outline"
                      className="rounded-full border-border/50 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
                    >
                      {name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-12 pt-6">
          <div className="space-y-8">
            <Card className="rounded-2xl border border-border/50 bg-card/60 px-6 py-6 shadow-[0_24px_80px_-60px_rgba(15,23,42,0.8)] backdrop-blur">
              <div className="space-y-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
                    <div className="space-y-1">
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
                    <div className="flex items-center justify-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <ArrowRight
                          className="h-4 w-4 text-primary"
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                    <div className="space-y-1 text-left sm:text-right">
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
                  <div className="text-left sm:text-right">
                    <p className="text-2xl font-semibold text-foreground">
                      {formattedPrice}
                    </p>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
                      Total fare
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {summaryMetrics.map(({ label, value, icon: Icon }) => (
                    <div
                      key={label}
                      className="inline-flex items-center gap-2 rounded-full border border-border/40 bg-background/80 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground"
                    >
                      <Icon
                        className="h-3.5 w-3.5 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span>{label}</span>
                      <span className="text-foreground/90">{value}</span>
                    </div>
                  ))}
                </div>

                <p className="text-xs leading-relaxed text-muted-foreground/80">
                  Track this itinerary to monitor schedule changes, award space,
                  and pricing variations. Flight data refreshes in near
                  real-time as availability updates.
                </p>
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
                  const isMultiLeg = slice.legs.length > 1;
                  const firstLeg = slice.legs[0];
                  const lastLeg = slice.legs[slice.legs.length - 1];
                  const sliceDeparture = format(
                    parseISO(firstLeg.departureDateTime),
                    "MMM d • h:mm a",
                  );
                  const sliceArrival = format(
                    parseISO(lastLeg.arrivalDateTime),
                    "MMM d • h:mm a",
                  );
                  const routeAirports = [
                    firstLeg.departureAirportCode,
                    ...slice.legs.map((leg) => leg.arrivalAirportCode),
                  ];
                  const routeDisplay = routeAirports
                    .filter(Boolean)
                    .join(" → ");
                  const sliceAirlineNames = Array.from(
                    new Set(
                      slice.legs
                        .map((leg) => toTitleCase(leg.airlineName))
                        .filter((name) => name.length > 0),
                    ),
                  );

                  return (
                    <Card
                      key={sliceKey}
                      className="rounded-2xl border border-border/50 bg-card/60 px-5 py-6 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4 text-xs text-muted-foreground">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                              {sliceIndex + 1}
                            </span>
                            Flight {sliceIndex + 1}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground/90">
                              {routeDisplay}
                            </span>
                          </div>
                          {sliceAirlineNames.length > 0 ? (
                            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
                              {sliceAirlineNames.join(" • ")}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-start gap-1 whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/80 sm:items-end">
                          <span className="inline-flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                            {durationLabel}
                          </span>
                          <span>{stopsLabel}</span>
                        </div>
                      </div>

                      <div className="mt-5 space-y-5">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{sliceDeparture}</span>
                          <span aria-hidden="true">→</span>
                          <span>{sliceArrival}</span>
                        </div>

                        {isMultiLeg ? (
                          <ol className="space-y-5">
                            {slice.legs.map((leg, legIndex) => {
                              const legKey = `${leg.airlineCode}${leg.flightNumber}-${leg.departureDateTime}`;
                              const legDepartureTime = format(
                                parseISO(leg.departureDateTime),
                                "MMM d • h:mm a",
                              );
                              const legArrivalTime = format(
                                parseISO(leg.arrivalDateTime),
                                "MMM d • h:mm a",
                              );
                              const legDuration = formatDuration(
                                leg.durationMinutes,
                              );
                              const airlineName = toTitleCase(leg.airlineName);
                              const isLastLeg =
                                legIndex === slice.legs.length - 1;

                              return (
                                <li
                                  key={legKey}
                                  className="flex gap-4 pb-2 last:pb-0"
                                >
                                  <div className="flex min-w-[1.25rem] flex-col items-center pt-1">
                                    <span className="flex h-2.5 w-2.5 items-center justify-center rounded-full border-2 border-primary bg-background">
                                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                    </span>
                                    {!isLastLeg && (
                                      <span className="mt-1 h-full w-px flex-1 bg-border/40" />
                                    )}
                                  </div>

                                  <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="space-y-1">
                                      <p className="text-sm font-semibold text-foreground">
                                        {leg.departureAirportCode} →{" "}
                                        {leg.arrivalAirportCode}
                                      </p>
                                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                        <span>
                                          {legDepartureTime} → {legArrivalTime}
                                        </span>
                                        <span
                                          aria-hidden="true"
                                          className="hidden sm:inline"
                                        >
                                          •
                                        </span>
                                        <span>
                                          {airlineName ||
                                            `${leg.airlineCode} ${leg.flightNumber}`}
                                        </span>
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        {toTitleCase(leg.departureAirportName)}{" "}
                                        → {toTitleCase(leg.arrivalAirportName)}
                                      </p>
                                      {!isLastLeg && (
                                        <p className="text-xs text-muted-foreground/70">
                                          Layover in{" "}
                                          {toTitleCase(leg.arrivalAirportName)}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex flex-col items-start gap-1 text-xs text-muted-foreground sm:items-end">
                                      <span className="font-semibold text-foreground">
                                        {legDuration}
                                      </span>
                                      <span>
                                        {leg.airlineCode} {leg.flightNumber}
                                      </span>
                                    </div>
                                  </div>
                                </li>
                              );
                            })}
                          </ol>
                        ) : (
                          (() => {
                            const leg = slice.legs[0];
                            const legDepartureTime = format(
                              parseISO(leg.departureDateTime),
                              "MMM d • h:mm a",
                            );
                            const legArrivalTime = format(
                              parseISO(leg.arrivalDateTime),
                              "MMM d • h:mm a",
                            );
                            const legDuration = formatDuration(
                              leg.durationMinutes,
                            );
                            const airlineName = toTitleCase(leg.airlineName);

                            return (
                              <div className="flex flex-col gap-4 rounded-xl border border-border/40 bg-background/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                                  <div className="space-y-1">
                                    <p className="text-sm font-semibold text-foreground">
                                      {leg.departureAirportCode}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {legDepartureTime}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {toTitleCase(leg.departureAirportName)}
                                    </p>
                                  </div>
                                  <div className="flex items-center justify-center text-muted-foreground">
                                    <ArrowRight
                                      className="h-4 w-4"
                                      aria-hidden="true"
                                    />
                                  </div>
                                  <div className="space-y-1 text-left sm:text-right">
                                    <p className="text-sm font-semibold text-foreground">
                                      {leg.arrivalAirportCode}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {legArrivalTime}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {toTitleCase(leg.arrivalAirportName)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-col items-start gap-1 text-xs text-muted-foreground sm:items-end">
                                  <span className="font-semibold text-foreground">
                                    {legDuration}
                                  </span>
                                  <span>
                                    {leg.airlineCode} {leg.flightNumber}
                                  </span>
                                  {airlineName ? (
                                    <span>{airlineName}</span>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })()
                        )}
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
                  {programGroups.map((program, programIndex) => {
                    const topAward = program.awards[0];
                    const programName = toTitleCase(program.source);
                    const isTopPick = programIndex === 0;

                    return (
                      <Card
                        key={program.source}
                        className="rounded-2xl border border-border/50 bg-card/60 px-5 py-5 shadow-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div>
                            <h4 className="text-sm font-semibold text-foreground">
                              {programName}
                            </h4>
                            {topAward ? (
                              <p className="text-xs text-muted-foreground">
                                Best rate{" "}
                                {MILEAGE_FORMATTER.format(topAward.mileageCost)}{" "}
                                miles in {topAward.cabinLabel}
                              </p>
                            ) : null}
                          </div>
                          {isTopPick && topAward ? (
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
                                    Redeem with {programName} miles
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-semibold text-foreground">
                                    {MILEAGE_FORMATTER.format(
                                      award.mileageCost,
                                    )}{" "}
                                    miles
                                  </p>
                                  {(() => {
                                    if (!award.totalTaxes) {
                                      return null;
                                    }
                                    const taxesAmount =
                                      Number.parseFloat(award.totalTaxes) / 100;
                                    if (Number.isNaN(taxesAmount)) {
                                      return null;
                                    }
                                    return (
                                      <p className="text-xs text-muted-foreground">
                                        +{" "}
                                        {formatCurrency(
                                          taxesAmount,
                                          award.taxesCurrency ||
                                            flightOption.currency,
                                        )}{" "}
                                        taxes
                                      </p>
                                    );
                                  })()}
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
