"use client";

import { format, parseISO } from "date-fns";
import { ArrowRight, Clock, Plane } from "lucide-react";
import { Fragment } from "react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { FlightOption } from "@/server/services/flights";

type FlightOptionsListProps = {
  options: FlightOption[];
  selectedDate: string | null;
  isLoading: boolean;
  error: string | null;
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

export function FlightOptionsList({
  options,
  selectedDate,
  isLoading,
  error,
}: FlightOptionsListProps) {
  const skeletonPlaceholders = [
    "loading-option-1",
    "loading-option-2",
    "loading-option-3",
  ] as const;

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
    <div className="space-y-4">
      {options.map((option, optionIndex) => {
        const formattedPrice = formatCurrency(
          option.totalPrice,
          option.currency,
        );
        const totalStops = option.slices.reduce(
          (sum, slice) => sum + slice.stops,
          0,
        );
        const summaryLabel =
          option.slices.length > 1
            ? `${option.slices.length} segments`
            : totalStops === 0
              ? "Nonstop"
              : `${totalStops} stop${totalStops > 1 ? "s" : ""}`;
        return (
          <div
            key={`${option.totalPrice}-${optionIndex}`}
            className="rounded-lg border bg-card/80 p-4 shadow-sm"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold">
                  Option {optionIndex + 1} • {formattedPrice}
                </p>
                <p className="text-xs text-muted-foreground">{summaryLabel}</p>
              </div>
              <Badge variant="secondary" className="w-fit">
                {option.currency}
              </Badge>
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
  );
}
