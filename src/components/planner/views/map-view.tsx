"use client";

import { useMemo } from "react";
import {
  AirportMap,
  type AirportMapPopularRoute,
} from "@/components/airport-map";
import { POPULAR_ROUTES } from "@/data/popular-routes";
import type { MapView } from "@/server/schemas/planner-view";
import type { AirportData } from "@/server/services/airports";

interface MapViewProps {
  view: MapView;
  airports: AirportData[];
}

/**
 * Map view component
 * Shows either popular routes or a specific route on the map
 */
export function MapViewComponent({ view, airports }: MapViewProps) {
  const airportsByIata = useMemo(() => {
    const map = new Map<string, AirportData>();
    for (const airport of airports) {
      if (airport.iata) {
        map.set(airport.iata.toUpperCase(), airport);
      }
    }
    return map;
  }, [airports]);

  const popularRoutesWithAirports = useMemo(() => {
    const enriched: AirportMapPopularRoute[] = [];
    for (const route of POPULAR_ROUTES) {
      const origin = airportsByIata.get(route.origin.iata.toUpperCase());
      const destination = airportsByIata.get(
        route.destination.iata.toUpperCase(),
      );
      if (origin && destination) {
        enriched.push({
          id: route.id,
          origin,
          destination,
          distanceMiles: route.distanceMiles,
        });
      }
    }
    return enriched;
  }, [airportsByIata]);

  // Determine which airports to highlight
  let originAirport: AirportData | null = null;
  let destAirport: AirportData | null = null;
  let activeRouteId: string | null = null;

  if (view.view === "route" && view.data) {
    originAirport = airportsByIata.get(view.data.origin.code) || null;
    destAirport = airportsByIata.get(view.data.destination.code) || null;

    if (originAirport && destAirport) {
      activeRouteId = `${view.data.origin.code}-${view.data.destination.code}`;
    }
  }

  return (
    <div className="flex h-full w-full flex-col">
      {/* Info overlay */}
      <div className="pointer-events-none absolute left-6 top-6 z-10 max-w-sm">
        <div className="pointer-events-auto rounded-xl border border-border/40 bg-background/95 p-4 shadow-lg backdrop-blur">
          {view.view === "route" && view.data ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Selected Route
              </p>
              <p className="text-xl font-semibold">
                {view.data.origin.code} → {view.data.destination.code}
              </p>
              <p className="text-sm text-muted-foreground">
                {view.data.origin.city}, {view.data.origin.country} /{" "}
                {view.data.destination.city}, {view.data.destination.country}
              </p>
              {view.data.distanceMiles && (
                <p className="text-xs text-muted-foreground">
                  Distance:{" "}
                  {Math.round(view.data.distanceMiles).toLocaleString()} mi
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Popular Routes
              </p>
              <p className="text-sm text-muted-foreground">
                Ask about any route or click a line to explore
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <AirportMap
        airports={airports}
        showAllAirports={false}
        originAirport={originAirport}
        destinationAirport={destAirport}
        popularRoutes={popularRoutesWithAirports}
        activeRouteId={activeRouteId}
      />
    </div>
  );
}
