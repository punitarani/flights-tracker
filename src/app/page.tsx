import dynamic from "next/dynamic";
import { Suspense } from "react";

import { Header } from "@/components/header";
import { getCachedAirports } from "@/lib/airports.server";

const FlightExplorer = dynamic(
  () => import("@/components/flight-explorer/flight-explorer-client"),
  {
    loading: () => <FlightExplorerFallback />,
  },
);

export const revalidate = 3600;

function FlightExplorerFallback() {
  return (
    <div className="flex-1 flex items-center justify-center bg-muted/15">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
        <p className="text-sm font-medium">Loading flight explorer…</p>
      </div>
    </div>
  );
}

export default async function Home() {
  const { airports, total } = await getCachedAirports();

  return (
    <div className="flex flex-col h-screen w-full bg-background">
      <Header />
      <Suspense fallback={<FlightExplorerFallback />}>
        <FlightExplorer
          airports={airports}
          totalAirports={total}
          isLoadingAirports={false}
        />
      </Suspense>
    </div>
  );
}
