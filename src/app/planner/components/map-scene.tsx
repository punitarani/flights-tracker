"use client";

import { useEffect, useState } from "react";
import type { PlannerMapScene } from "@/ai/types";
import { Loader } from "@/components/ai-elements/loader";
import {
  AirportMap,
  type AirportMapPopularRoute,
} from "@/components/airport-map";
import { api } from "@/lib/trpc/react";
import type { AirportData } from "@/server/services/airports";

interface MapSceneProps {
  scene: PlannerMapScene;
}

export function MapScene({ scene }: MapSceneProps) {
  const [selectedAirports, setSelectedAirports] = useState<AirportData[]>([]);

  // Fetch all airports for display
  const { data: allAirportsData, isLoading: isLoadingAirports } = api.useQuery([
    "airports.search",
    { limit: 1000 },
  ]);

  const allAirports = allAirportsData?.airports ?? [];

  // Fetch specific airports when in routes mode (we'll filter from all airports)
  const airportCodes =
    scene.mode === "routes" ? (scene.data?.airports ?? []) : [];

  // Update selected airports when scene changes
  useEffect(() => {
    if (scene.mode === "routes" && airportCodes.length > 0) {
      const filtered = allAirports.filter((airport: AirportData) =>
        airportCodes.includes(airport.iata),
      );
      setSelectedAirports(filtered);
    } else {
      setSelectedAirports([]);
    }
  }, [scene.mode, airportCodes, allAirports]);

  if (isLoadingAirports) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-2">
          <Loader />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  if (!allAirports || allAirports.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No airport data available</p>
      </div>
    );
  }

  // Popular routes mode - show common US routes
  if (scene.mode === "popular") {
    // Define some popular routes
    const popularRoutePairs = [
      ["LAX", "JFK"], // LA to NYC
      ["SFO", "JFK"], // SF to NYC
      ["LAX", "SFO"], // LA to SF
      ["ORD", "LAX"], // Chicago to LA
      ["ATL", "LAX"], // Atlanta to LA
      ["DFW", "LAX"], // Dallas to LA
      ["MIA", "JFK"], // Miami to NYC
      ["SEA", "LAX"], // Seattle to LA
    ];

    const popularRoutes: AirportMapPopularRoute[] = popularRoutePairs
      .map(([origin, dest]) => {
        const originAirport = allAirports.find(
          (a: AirportData) => a.iata === origin,
        );
        const destAirport = allAirports.find(
          (a: AirportData) => a.iata === dest,
        );

        if (originAirport && destAirport) {
          return {
            id: `${origin}-${dest}`,
            origin: originAirport,
            destination: destAirport,
          };
        }
        return null;
      })
      .filter((route): route is AirportMapPopularRoute => route !== null);

    return (
      <div className="h-full w-full">
        <AirportMap
          airports={allAirports}
          showAllAirports={false}
          popularRoutes={popularRoutes}
        />
      </div>
    );
  }

  // Routes mode - show specific airport connections
  if (scene.mode === "routes") {
    if (selectedAirports.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <p>No airports selected</p>
        </div>
      );
    }

    // Create routes between consecutive airports
    const routes: AirportMapPopularRoute[] =
      selectedAirports.length >= 2
        ? selectedAirports.slice(0, -1).map((origin, index) => {
            const dest = selectedAirports[index + 1];
            return {
              id: `${origin.iata}-${dest?.iata}`,
              origin,
              destination: dest as AirportData,
            };
          })
        : [];

    return (
      <div className="h-full w-full">
        <AirportMap
          airports={allAirports}
          showAllAirports={false}
          popularRoutes={routes}
          waypoints={selectedAirports}
        />
      </div>
    );
  }

  return null;
}
