import { Clock, Plane } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface FlightResult {
  price: number;
  currency: string;
  origin: string;
  destination: string;
  departureTime?: string;
  arrivalTime?: string;
  duration: number;
  stops: number;
  airlines: string[];
}

interface FlightResultsUIProps {
  route: string;
  flights: FlightResult[];
  cheapestPrice?: number;
}

/**
 * AI-Generated Server Component: Flight Results
 * Shows flight options with details in a clean card grid
 */
export function FlightResultsUI({
  route,
  flights,
  cheapestPrice,
}: FlightResultsUIProps) {
  if (!flights || flights.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            No flights found for this route
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Plane className="h-4 w-4" />
          Flights: {route}
        </h3>
        <Badge variant="secondary">{flights.length} options</Badge>
      </div>

      <div className="space-y-2">
        {flights.map((flight, idx) => (
          <Card
            key={idx}
            className={
              cheapestPrice && flight.price === cheapestPrice
                ? "border-green-500"
                : ""
            }
          >
            <CardContent className="pt-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {flight.origin} → {flight.destination}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {flight.stops === 0
                        ? "Non-stop"
                        : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
                    </Badge>
                  </div>

                  {flight.departureTime && flight.arrivalTime && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        {flight.departureTime} - {flight.arrivalTime}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Plane className="h-3 w-3" />
                      {flight.airlines.join(", ")}
                    </span>
                    <span>
                      {Math.floor(flight.duration / 60)}h {flight.duration % 60}
                      m
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={`text-2xl font-bold ${
                      cheapestPrice && flight.price === cheapestPrice
                        ? "text-green-600"
                        : "text-primary"
                    }`}
                  >
                    ${flight.price}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {flight.currency}
                  </div>
                  {cheapestPrice && flight.price === cheapestPrice && (
                    <Badge variant="default" className="mt-1 bg-green-600">
                      Cheapest
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
