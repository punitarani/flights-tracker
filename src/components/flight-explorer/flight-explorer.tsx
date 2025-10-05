"use client";

import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { AirportData } from "@/server/services/airports";
import { AirportMapView } from "./airport-map-view";
import { FlightPricePanel } from "./flight-price-panel";
import { RouteSearchPanel } from "./route-search-panel";
import { useFlightExplorer } from "./use-flight-explorer";

type FlightExplorerProps = {
  airports: AirportData[];
  totalAirports: number;
  isLoadingAirports: boolean;
};

export function FlightExplorer({
  airports,
  totalAirports,
  isLoadingAirports,
}: FlightExplorerProps) {
  const isInitialLoading = isLoadingAirports && airports.length === 0;

  const { search, header, map, price } = useFlightExplorer({
    airports,
    totalAirports,
    isInitialLoading,
  });

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <RouteSearchPanel search={search} header={header} />

      <div className="flex-1 relative">
        {header.isInitialLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
            <Card className="p-6 flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium">Loading airports...</span>
            </Card>
          </div>
        ) : price.shouldShowPanel ? (
          <FlightPricePanel state={price} />
        ) : (
          <AirportMapView state={map} />
        )}
      </div>
    </div>
  );
}
