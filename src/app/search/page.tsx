"use client";

import { Suspense } from "react";
import { FlightExplorer } from "@/components/flight-explorer";
import { Header } from "@/components/header";
import { api } from "@/lib/trpc/react";

/**
 * Search page (/search) - Displays flight search results with price chart and options.
 * Query params (origin, destination, dates, filters) are read via nuqs to hydrate state.
 */
export default function SearchPage() {
  const airportSearchQuery = api.useQuery(
    ["airports.search", { limit: 10000 }],
    {
      retry: (failureCount, error) => {
        // Don't retry on AbortError (user cancelled request)
        if (
          error?.message?.includes("AbortError") ||
          error?.message?.includes("aborted")
        ) {
          return false;
        }
        // Standard retry logic for other errors
        return failureCount < 3;
      },
      onError: (error) => {
        // Silently handle AbortError - user cancelled request intentionally
        if (
          error?.message?.includes("AbortError") ||
          error?.message?.includes("aborted")
        ) {
          return;
        }
        // Log other errors for debugging
        console.error("Airport search error:", error);
      },
    },
  );

  const airports = airportSearchQuery.data?.airports ?? [];
  const totalAirports = airportSearchQuery.data?.total ?? airports.length;
  const isLoadingAirports = airportSearchQuery.isLoading;

  return (
    <div className="flex flex-col h-screen w-full bg-background">
      <Header />
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
