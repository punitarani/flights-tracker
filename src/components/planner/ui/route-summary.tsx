"use client";

import { MapPin, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { RouteSummaryData } from "@/server/schemas/planner-view";

interface RouteSummaryProps {
  data: RouteSummaryData;
  onClick?: () => void;
}

/**
 * Route summary card
 * Shows overview of a flight route with key metrics
 */
export function RouteSummary({ data, onClick }: RouteSummaryProps) {
  const hasClick = Boolean(onClick);

  return (
    <Card
      className={`transition-all ${hasClick ? "cursor-pointer hover:border-primary/50 hover:shadow-md" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Route */}
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="font-semibold">
              {data.origin} → {data.destination}
            </span>
          </div>

          {/* Metrics */}
          <div className="flex flex-wrap gap-3 text-sm">
            {data.distance && (
              <div className="text-muted-foreground">
                <span className="font-medium">Distance:</span>{" "}
                {Math.round(data.distance).toLocaleString()} mi
              </div>
            )}
            {data.avgPrice && (
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                <span className="text-muted-foreground">
                  <span className="font-medium">Avg Price:</span> $
                  {data.avgPrice}
                </span>
              </div>
            )}
          </div>

          {/* Airlines */}
          {data.popularAirlines && data.popularAirlines.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {data.popularAirlines.map((airline) => (
                <Badge key={airline} variant="secondary" className="text-xs">
                  {airline}
                </Badge>
              ))}
            </div>
          )}

          {/* Cheapest date */}
          {data.cheapestDate && (
            <div className="text-xs text-muted-foreground">
              Best date: {data.cheapestDate}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
