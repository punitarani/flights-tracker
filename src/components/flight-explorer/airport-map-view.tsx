"use client";

import {
  AirportMap,
  type AirportMapPopularRoute,
} from "@/components/airport-map";
import type { FlightExplorerMapState } from "@/hooks/use-flight-explorer";

type AirportMapViewProps = {
  state: FlightExplorerMapState;
  popularRoutes?: AirportMapPopularRoute[];
  activeRouteId?: string | null;
  onRouteHover?: (route: AirportMapPopularRoute | null) => void;
  onRouteSelect?: (route: AirportMapPopularRoute) => void;
};

export function AirportMapView({
  state,
  popularRoutes,
  activeRouteId,
  onRouteHover,
  onRouteSelect,
}: AirportMapViewProps) {
  return (
    <AirportMap
      airports={state.displayedAirports}
      originAirport={state.originAirport}
      destinationAirport={state.destinationAirport}
      showAllAirports={state.showAllAirports}
      onMapReady={state.onMapReady}
      onAirportClick={state.onAirportClick}
      popularRoutes={popularRoutes}
      activeRouteId={activeRouteId}
      onRouteHover={onRouteHover}
      onRouteSelect={onRouteSelect}
    />
  );
}
