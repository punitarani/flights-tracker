import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { FlightResult } from "../types";

interface FlightCardProps {
  flight: FlightResult;
  onSelect?: (flight: FlightResult) => void;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatTime(dateTimeStr: string): string {
  const date = new Date(dateTimeStr);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "p" : "a";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")}${ampm}`;
}

function formatDate(dateTimeStr: string): string {
  const date = new Date(dateTimeStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getAirportCode(airportStr: string): string {
  // If already a 3-letter code, return as-is
  if (/^[A-Z]{3}$/.test(airportStr)) {
    return airportStr;
  }

  // Extract code from "Airport Name (CODE)" format
  const match = airportStr.match(/\(([A-Z]{3})\)/);
  if (match?.[1]) {
    return match[1];
  }

  // If it's a longer string, try to extract last 3 capital letters
  const codeMatch = airportStr.match(/([A-Z]{3})$/);
  if (codeMatch?.[1]) {
    return codeMatch[1];
  }

  // Fallback: return first 3 chars or the whole string
  return airportStr.substring(0, 3).toUpperCase();
}

function getDayDifference(departure: string, arrival: string): number {
  const depDate = new Date(departure);
  const arrDate = new Date(arrival);
  const depDay = new Date(
    depDate.getFullYear(),
    depDate.getMonth(),
    depDate.getDate(),
  );
  const arrDay = new Date(
    arrDate.getFullYear(),
    arrDate.getMonth(),
    arrDate.getDate(),
  );
  return Math.round(
    (arrDay.getTime() - depDay.getTime()) / (1000 * 60 * 60 * 24),
  );
}

export function FlightCard({ flight }: FlightCardProps) {
  const firstLeg = flight.legs[0];
  const lastLeg = flight.legs[flight.legs.length - 1];

  if (!firstLeg || !lastLeg) {
    return null;
  }

  const dayDiff = getDayDifference(
    firstLeg.departure.dateTime,
    lastLeg.arrival.dateTime,
  );

  // Get unique airlines
  const airlines = Array.from(new Set(flight.legs.map((leg) => leg.airline)));
  const airlineText = airlines.join(", ");

  // Calculate layover info if there are stops
  let layoverText = "";
  if (flight.stops > 0 && flight.legs.length > 1) {
    // Find longest layover
    let maxLayover = 0;
    let layoverAirport = "";
    for (let i = 0; i < flight.legs.length - 1; i++) {
      const currentLeg = flight.legs[i];
      const nextLeg = flight.legs[i + 1];
      if (currentLeg && nextLeg) {
        const arrivalTime = new Date(currentLeg.arrival.dateTime).getTime();
        const departureTime = new Date(nextLeg.departure.dateTime).getTime();
        const layoverMinutes = (departureTime - arrivalTime) / (1000 * 60);
        if (layoverMinutes > maxLayover) {
          maxLayover = layoverMinutes;
          layoverAirport = getAirportCode(currentLeg.arrival.airport);
        }
      }
    }
    if (maxLayover > 0) {
      layoverText = `${formatDuration(maxLayover)} layover in ${layoverAirport}`;
    }
  }

  return (
    <Card className="px-3 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer">
      <div className="flex items-start justify-between gap-3">
        {/* Left: Flight info */}
        <div className="flex-1 min-w-0 space-y-0.5">
          {/* Line 1: Date and stops */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatDate(firstLeg.departure.dateTime)}</span>
            <span>•</span>
            {flight.stops === 0 ? (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                Nonstop
              </Badge>
            ) : (
              <span>
                {flight.stops} {flight.stops === 1 ? "stop" : "stops"}
              </span>
            )}
          </div>

          {/* Line 2: Times and duration */}
          <div className="flex items-baseline gap-2 text-sm">
            <span className="font-semibold">
              {formatTime(firstLeg.departure.dateTime)}
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="font-semibold">
              {formatTime(lastLeg.arrival.dateTime)}
              {dayDiff > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  +{dayDiff}
                </span>
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDuration(flight.duration)}
            </span>
          </div>

          {/* Line 3: Route and airline */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-medium">
              {getAirportCode(firstLeg.departure.airport)} →{" "}
              {getAirportCode(lastLeg.arrival.airport)}
            </span>
            <span>•</span>
            <span className="truncate">{airlineText}</span>
            {layoverText && (
              <>
                <span>•</span>
                <span className="truncate">{layoverText}</span>
              </>
            )}
          </div>
        </div>

        {/* Right: Price */}
        <div className="text-right shrink-0">
          <div className="text-lg font-bold">${flight.price}</div>
        </div>
      </div>
    </Card>
  );
}
