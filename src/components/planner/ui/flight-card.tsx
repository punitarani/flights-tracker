"use client";

import { Clock, Plane } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { FlightCardData } from "@/server/schemas/planner-view";

interface FlightCardProps {
  flight: FlightCardData;
  onClick?: () => void;
}

/**
 * Flight card component for chat UI
 * Displays flight details in a compact, clickable card
 */
export function FlightCard({ flight, onClick }: FlightCardProps) {
  const hasClick = Boolean(onClick);

  return (
    <Card
      className={`transition-all ${hasClick ? "cursor-pointer hover:border-primary/50 hover:shadow-md" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            {/* Route */}
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base">
                {flight.origin} → {flight.destination}
              </span>
              <Badge variant="outline" className="text-xs">
                {flight.stops === 0
                  ? "Non-stop"
                  : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
              </Badge>
            </div>

            {/* Date and Time */}
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>{flight.departureDate}</span>
              {flight.departureTime && flight.arrivalTime && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {flight.departureTime} - {flight.arrivalTime}
                </span>
              )}
            </div>

            {/* Airlines and Duration */}
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

          {/* Price */}
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">
              ${flight.price}
            </div>
            <div className="text-xs text-muted-foreground">
              {flight.currency}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
