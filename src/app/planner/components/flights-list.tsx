import type { FlightResult } from "../types";
import { FlightCard } from "./flight-card";

interface FlightsListProps {
  flights: FlightResult[];
  onSelectFlight?: (flight: FlightResult) => void;
}

export function FlightsList({ flights, onSelectFlight }: FlightsListProps) {
  if (flights.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>No flights found matching your criteria.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Found {flights.length} {flights.length === 1 ? "flight" : "flights"}
      </div>
      <div className="grid gap-4">
        {flights.map((flight, index) => (
          <FlightCard
            key={`${flight.price}-${index}`}
            flight={flight}
            onSelect={onSelectFlight}
          />
        ))}
      </div>
    </div>
  );
}
