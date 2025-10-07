"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import { PopularRoutesBoard } from "@/components/popular-routes-board";
import { Card } from "@/components/ui/card";
import { POPULAR_ROUTES } from "@/data/popular-routes";
import { useFlightExplorer } from "@/hooks/use-flight-explorer";
import type { AirportData } from "@/server/services/airports";
import { AirportMapView } from "./airport-map-view";
import { FlightPricePanel } from "./flight-price-panel";
import { RouteSearchPanel } from "./route-search-panel";

export type FlightExplorerProps = {
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

  const {
    search,
    header,
    map: mapState,
    price,
    filters,
  } = useFlightExplorer({
    airports,
    totalAirports,
    isInitialLoading,
  });

  const selectedPopularRoute = useMemo(() => {
    if (!mapState.originAirport || !mapState.destinationAirport) {
      return null;
    }

    const originCode = mapState.originAirport.iata;
    const destinationCode = mapState.destinationAirport.iata;
    const directId = `${originCode}-${destinationCode}`;
    const inverseId = `${destinationCode}-${originCode}`;

    return (
      POPULAR_ROUTES.find(
        (route) => route.id === directId || route.id === inverseId,
      ) ?? null
    );
  }, [mapState.destinationAirport, mapState.originAirport]);

  const handleSelectPopularRoute = useCallback(
    (originIata: string, destinationIata: string) => {
      search.selectRoute(originIata, destinationIata);
    },
    [search],
  );

  const hasSelectedRoute = Boolean(
    mapState.originAirport && mapState.destinationAirport,
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <RouteSearchPanel search={search} header={header} />

      <div className="relative flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),_transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,_rgba(15,23,42,0.08),_transparent_40%,_rgba(15,23,42,0.12)_92%)]" />

        <div className="relative flex h-full flex-col">
          {header.isInitialLoading ? (
            <div className="flex flex-1 items-center justify-center bg-muted/20">
              <Card className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card/70 px-6 py-5 shadow-lg backdrop-blur">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm font-medium">Loading airports...</span>
              </Card>
            </div>
          ) : price.shouldShowPanel ? (
            <FlightPricePanel
              state={price}
              filters={filters}
              originAirport={mapState.originAirport}
              destinationAirport={mapState.destinationAirport}
            />
          ) : (
            <div className="container mx-auto flex h-full w-full flex-col px-4 pb-8 pt-6 sm:px-6 lg:px-8 lg:pb-10">
              {!hasSelectedRoute ? (
                <div className="flex h-full w-full">
                  <PopularRoutesBoard
                    selectedRouteId={selectedPopularRoute?.id ?? null}
                    onSelectRoute={(route) =>
                      handleSelectPopularRoute(
                        route.origin.iata,
                        route.destination.iata,
                      )
                    }
                    onClearSelection={search.clearRoute}
                  />
                </div>
              ) : (
                <div className="flex h-full w-full">
                  <div className="relative flex h-full w-full min-h-[360px] overflow-hidden rounded-3xl border border-border/40 bg-card/40 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.55)] backdrop-blur-xl">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_70%)]" />
                    <AirportMapView state={mapState} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
