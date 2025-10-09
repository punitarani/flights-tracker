"use client";

import { useQueryStates } from "nuqs";
import { Suspense } from "react";
import { FlightExplorer } from "@/components/flight-explorer";
import { flightExplorerQueryParsers } from "@/components/flight-explorer/query-state";
import { Header } from "@/components/header";
import { trpc } from "@/lib/trpc/react";

/**
 * Search page (/search) - Displays flight search results with price chart and options.
 * Query params (origin, destination, dates, filters) are read via nuqs to hydrate state.
 */
export default function SearchPage() {
  const { data: airportSearchData, isLoading: isLoadingAirports } =
    trpc.useQuery(["airports.search", { limit: 10000 }]);
  const airports = airportSearchData?.airports ?? [];
  const totalAirports = airportSearchData?.total ?? airports.length;

  // Get route data from query params for header
  const [queryState] = useQueryStates(flightExplorerQueryParsers);
  const route =
    queryState.origin && queryState.destination
      ? {
          origin: queryState.origin,
          destination: queryState.destination,
        }
      : undefined;

  return (
    <div className="flex flex-col h-screen w-full bg-background">
      <Header route={route} />
      <Suspense fallback={null}>
        <FlightExplorer
          airports={airports}
          totalAirports={totalAirports}
          isLoadingAirports={isLoadingAirports}
        />
      </Suspense>
    </div>
  );
}
