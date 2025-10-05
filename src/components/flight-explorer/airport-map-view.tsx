"use client";

import { AirportMap } from "@/components/airport-map";
import type { FlightExplorerMapState } from "./use-flight-explorer";

type AirportMapViewProps = {
  state: FlightExplorerMapState;
};

export function AirportMapView({ state }: AirportMapViewProps) {
  return (
    <AirportMap
      airports={state.displayedAirports}
      originAirport={state.originAirport}
      destinationAirport={state.destinationAirport}
      showAllAirports={state.showAllAirports}
      onMapReady={state.onMapReady}
      onAirportClick={state.onAirportClick}
    />
  );
}
