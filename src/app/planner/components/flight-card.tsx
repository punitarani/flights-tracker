import { Clock, MapPin, Plane } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { FlightResult } from "../types";

interface FlightCardProps {
  flight: FlightResult;
  onSelect?: (flight: FlightResult) => void;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function formatTime(dateTimeStr: string): string {
  const date = new Date(dateTimeStr);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(dateTimeStr: string): string {
  const date = new Date(dateTimeStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function FlightCard({ flight, onSelect }: FlightCardProps) {
  const firstLeg = flight.legs[0];
  const lastLeg = flight.legs[flight.legs.length - 1];

  if (!firstLeg || !lastLeg) {
    return null;
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{formatDate(firstLeg.departure.dateTime)}</span>
              {flight.stops === 0 ? (
                <Badge variant="secondary" className="text-xs">
                  Nonstop
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  {flight.stops} {flight.stops === 1 ? "stop" : "stops"}
                </Badge>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">${flight.price}</div>
            <div className="text-xs text-muted-foreground">per person</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Flight Legs */}
        <div className="space-y-2">
          {flight.legs.map((leg, index) => (
            <div key={`${leg.flightNumber}-${index}`}>
              {index > 0 && (
                <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
                  <div className="h-px flex-1 bg-border" />
                  <span>Layover</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-semibold">
                      {formatTime(leg.departure.dateTime)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {leg.departure.airport}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1 text-muted-foreground min-w-[80px]">
                  <div className="text-xs">{formatDuration(leg.duration)}</div>
                  <div className="flex items-center gap-1 w-full">
                    <div className="h-px flex-1 bg-border" />
                    <Plane className="h-3 w-3" />
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="text-xs">
                    {leg.airline} {leg.flightNumber}
                  </div>
                </div>

                <div className="flex-1 text-right">
                  <div className="flex items-baseline gap-2 justify-end">
                    <span className="text-xl font-semibold">
                      {formatTime(leg.arrival.dateTime)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {leg.arrival.airport}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="flex items-center gap-4 pt-2 text-sm text-muted-foreground border-t">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{formatDuration(flight.duration)}</span>
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            <span>
              {firstLeg.departure.airport} → {lastLeg.arrival.airport}
            </span>
          </div>
        </div>

        {onSelect && (
          <Button onClick={() => onSelect(flight)} className="w-full">
            Select Flight
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
