"use client";

import { FlightExplorer } from "@/components/flight-explorer";
import { Header } from "@/components/header";
import { trpc } from "@/lib/trpc/react";

export default function Home() {
  const { data: airportSearchData, isLoading: isLoadingAirports } =
    trpc.useQuery(["airports.search", { limit: 10000 }]);
  const airports = airportSearchData?.airports ?? [];
  const totalAirports = airportSearchData?.total ?? airports.length;

  return (
    <div className="flex flex-col h-screen w-full bg-background">
      <Header />
      <FlightExplorer
        airports={airports}
        totalAirports={totalAirports}
        isLoadingAirports={isLoadingAirports}
      />
    </div>
  );
}
