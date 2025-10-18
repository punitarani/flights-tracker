"use client";

import { Calendar, DollarSign, MapPin, Plane } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SearchView } from "@/server/schemas/planner-view";

interface SearchViewProps {
  view: SearchView;
}

/**
 * Search view component
 * Shows flight search results with filters and summary
 */
export function SearchViewComponent({ view }: SearchViewProps) {
  return (
    <div className="flex h-full w-full flex-col overflow-auto p-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {/* Route Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold">
                {view.route.origin.code} → {view.route.destination.code}
              </h2>
              <Badge variant="secondary" className="text-xs">
                {view.flightCount} flights found
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {view.route.origin.city}, {view.route.origin.country} to{" "}
              {view.route.destination.city}, {view.route.destination.country}
            </p>
          </div>
        </div>

        {/* Filters Summary */}
        {view.filters && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Active Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {view.filters.dateFrom && view.filters.dateTo && (
                  <Badge variant="outline" className="gap-1.5">
                    <Calendar className="h-3 w-3" />
                    {view.filters.dateFrom} to {view.filters.dateTo}
                  </Badge>
                )}
                {view.filters.maxPrice && (
                  <Badge variant="outline" className="gap-1.5">
                    <DollarSign className="h-3 w-3" />
                    Under ${view.filters.maxPrice}
                  </Badge>
                )}
                {view.filters.stops && view.filters.stops !== "any" && (
                  <Badge variant="outline" className="gap-1.5">
                    <Plane className="h-3 w-3" />
                    {view.filters.stops === "0"
                      ? "Non-stop only"
                      : `Max ${view.filters.stops} stop`}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Map Integration */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 bg-muted/30 px-4 py-3">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                Route: {view.route.origin.city} to {view.route.destination.city}
              </span>
              {view.route.distanceMiles && (
                <span className="text-xs text-muted-foreground ml-auto">
                  {Math.round(view.route.distanceMiles).toLocaleString()} miles
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results Info */}
        <div className="text-center text-sm text-muted-foreground py-8">
          Check the chat for detailed flight options and recommendations
        </div>
      </div>
    </div>
  );
}
