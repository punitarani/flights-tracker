"use client";

import { Clock, Plane } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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

interface FlightListCardProps {
  route: string;
  flights: FlightResult[];
  cheapestPrice?: number;
  date?: string;
  onViewDetails?: (flight: FlightResult) => void;
}

/**
 * Enhanced Flight List Card with AI Elements integration
 * Shows flight options with expandable details and actions
 */
export function FlightListCard({
  route,
  flights,
  cheapestPrice,
  date,
  onViewDetails,
}: FlightListCardProps) {
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
          {date && (
            <span className="text-sm text-muted-foreground font-normal">
              on {date}
            </span>
          )}
        </h3>
        <Badge variant="secondary">{flights.length} options</Badge>
      </div>

      <div className="space-y-2">
        {flights.map((flight, idx) => (
          <FlightCard
            key={`${flight.origin}-${flight.destination}-${flight.price}-${idx}`}
            flight={flight}
            isCheapest={cheapestPrice && flight.price === cheapestPrice}
            onViewDetails={onViewDetails}
          />
        ))}
      </div>
    </div>
  );
}

function FlightCard({
  flight,
  isCheapest,
  onViewDetails,
}: {
  flight: FlightResult;
  isCheapest?: boolean;
  onViewDetails?: (flight: FlightResult) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card
        className={
          isCheapest
            ? "border-green-500 bg-green-500/5"
            : "hover:border-primary/50"
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
                  {Math.floor(flight.duration / 60)}h {flight.duration % 60}m
                </span>
              </div>
            </div>

            <div className="text-right">
              <div
                className={`text-2xl font-bold ${
                  isCheapest ? "text-green-600" : "text-primary"
                }`}
              >
                ${flight.price}
              </div>
              <div className="text-xs text-muted-foreground">
                {flight.currency}
              </div>
              {isCheapest && (
                <Badge variant="default" className="mt-1 bg-green-600">
                  Cheapest
                </Badge>
              )}
            </div>
          </div>

          <CollapsibleContent className="pt-3 border-t mt-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => onViewDetails?.(flight)}
              >
                View Details
              </Button>
              <Button variant="default" size="sm" className="w-full">
                Book Flight
              </Button>
            </div>
          </CollapsibleContent>

          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full mt-2 text-xs">
              {isOpen ? "Hide" : "Show"} Details
            </Button>
          </CollapsibleTrigger>
        </CardContent>
      </Card>
    </Collapsible>
  );
}
