import type { FlightResult } from "../types";
import { FlightCard } from "./flight-card";

interface FlightsListProps {
  flights: FlightResult[];
  onSelectFlight?: (flight: FlightResult) => void;
}

const MAX_DISPLAYED_FLIGHTS = 5;

export function FlightsList({ flights, onSelectFlight }: FlightsListProps) {
  if (flights.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <p className="text-sm">No flights found matching your criteria.</p>
      </div>
    );
  }

  const displayedFlights = flights.slice(0, MAX_DISPLAYED_FLIGHTS);
  const totalFlights = flights.length;
  const hasMore = totalFlights > MAX_DISPLAYED_FLIGHTS;

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        {hasMore ? (
          <>
            Showing {displayedFlights.length} best of {totalFlights} flights
          </>
        ) : (
          <>
            {totalFlights} {totalFlights === 1 ? "flight" : "flights"} found
          </>
        )}
      </div>
      <div className="grid gap-2">
        {displayedFlights.map((flight, index) => (
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
