"use client";

import { format, parseISO } from "date-fns";
import { Loader2, Plane } from "lucide-react";
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import type { SeatsAeroAvailabilityTripModel } from "@/lib/fli/models/seats-aero";
import { trpc } from "@/lib/trpc/react";
import type { AirportData } from "@/server/services/airports";

type AwardAvailabilityPanelProps = {
  originAirport: AirportData;
  destinationAirport: AirportData;
  startDate: string;
  endDate: string;
};

const MILEAGE_FORMATTER = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});

type CabinSummary = {
  cabin: "Economy" | "Premium Economy" | "Business" | "First";
  cabinKey: "economy" | "premium_economy" | "business" | "first";
  minMileage: number | null;
  directMinMileage: number | null;
  tripCount: number;
};

function extractCabinSummaries(
  trips: SeatsAeroAvailabilityTripModel[],
): CabinSummary[] {
  const cabinMap = new Map<string, CabinSummary>();

  const cabinLabels: Record<
    string,
    "Economy" | "Premium Economy" | "Business" | "First"
  > = {
    economy: "Economy",
    premium_economy: "Premium Economy",
    business: "Business",
    first: "First",
  };

  for (const trip of trips) {
    const key = trip.cabinClass;
    const existing = cabinMap.get(key);

    if (!existing) {
      cabinMap.set(key, {
        cabin: cabinLabels[key] || "Economy",
        cabinKey: key as "economy" | "premium_economy" | "business" | "first",
        minMileage: trip.mileageCost,
        directMinMileage: trip.stops === 0 ? trip.mileageCost : null,
        tripCount: 1,
      });
    } else {
      // Update min mileage
      if (trip.mileageCost < (existing.minMileage ?? Infinity)) {
        existing.minMileage = trip.mileageCost;
      }

      // Update direct min mileage
      if (trip.stops === 0) {
        if (
          existing.directMinMileage === null ||
          trip.mileageCost < existing.directMinMileage
        ) {
          existing.directMinMileage = trip.mileageCost;
        }
      }

      existing.tripCount += 1;
    }
  }

  // Sort by cabin order: Economy, Premium Economy, Business, First
  const order = ["economy", "premium_economy", "business", "first"];
  return Array.from(cabinMap.values()).sort(
    (a, b) => order.indexOf(a.cabinKey) - order.indexOf(b.cabinKey),
  );
}

export function AwardAvailabilityPanel({
  originAirport,
  destinationAirport,
  startDate,
  endDate,
}: AwardAvailabilityPanelProps) {
  // Trigger the search to populate cache
  const { isLoading: isSearching } = trpc.useQuery([
    "seatsAero.search",
    {
      originAirport: originAirport.iata,
      destinationAirport: destinationAirport.iata,
      startDate,
      endDate,
      useCache: true,
    },
  ]);

  // Get the normalized trips
  const {
    data: trips,
    isLoading: isLoadingTrips,
    error,
  } = trpc.useQuery([
    "seatsAero.getTrips",
    {
      originAirport: originAirport.iata,
      destinationAirport: destinationAirport.iata,
      searchStartDate: startDate,
      searchEndDate: endDate,
    },
  ]);

  const cabinSummaries = useMemo(() => {
    if (!trips) return [];
    return extractCabinSummaries(trips);
  }, [trips]);

  const dateRangeDisplay = useMemo(() => {
    try {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
    } catch {
      return `${startDate} - ${endDate}`;
    }
  }, [startDate, endDate]);

  const isLoading = isSearching || isLoadingTrips;

  return (
    <Card className="space-y-4 p-4">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold">Award Availability</h4>
        <p className="text-xs text-muted-foreground">
          {originAirport.iata} → {destinationAirport.iata} • {dateRangeDisplay}
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading award availability...</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error.message || "Failed to load award availability"}
        </div>
      )}

      {!isLoading && !error && cabinSummaries.length === 0 && (
        <p className="py-2 text-sm text-muted-foreground">
          No award availability found for this route.
        </p>
      )}

      {!isLoading && !error && cabinSummaries.length > 0 && (
        <div className="space-y-2">
          {cabinSummaries.map((cabin) => (
            <div
              key={cabin.cabinKey}
              className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <Plane className="h-4 w-4 text-primary" />
                <div>
                  <span className="text-sm font-medium">{cabin.cabin}</span>
                  <p className="text-xs text-muted-foreground">
                    {cabin.tripCount}{" "}
                    {cabin.tripCount === 1 ? "option" : "options"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                {cabin.minMileage !== null && (
                  <div className="text-sm font-semibold">
                    {MILEAGE_FORMATTER.format(cabin.minMileage)} miles
                  </div>
                )}
                {cabin.directMinMileage !== null && (
                  <div className="text-xs text-muted-foreground">
                    Direct: {MILEAGE_FORMATTER.format(cabin.directMinMileage)}
                  </div>
                )}
              </div>
            </div>
          ))}
          {trips && trips.length > 0 && (
            <p className="pt-1 text-xs text-muted-foreground">
              Showing lowest miles from {trips.length} flight
              {trips.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
