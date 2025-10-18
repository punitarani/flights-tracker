"use client";

import { AlertCircle, MapPin, Navigation } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Airport {
  code: string;
  name: string;
  city: string;
  country: string;
}

interface RouteAnalysisCardProps {
  route: string;
  origin: Airport;
  destination: Airport;
  distanceMiles: number;
  sameCity?: boolean;
  recommendation?: string;
  onViewOnMap?: () => void;
}

/**
 * Enhanced Route Analysis Card with AI Elements integration
 * Shows route information, distance, validation, and actions
 */
export function RouteAnalysisCard({
  route,
  origin,
  destination,
  distanceMiles,
  sameCity,
  recommendation,
  onViewOnMap,
}: RouteAnalysisCardProps) {
  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <div className="flex items-center gap-2">
            <Navigation className="h-4 w-4 text-primary" />
            <span>Route Analysis: {route}</span>
          </div>
          {onViewOnMap && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewOnMap}
              className="text-xs"
            >
              View on Map
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Route details */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="h-3 w-3 text-red-500" />
              <span>Origin</span>
            </div>
            <p className="text-sm">
              {origin.name} ({origin.code})
            </p>
            <p className="text-xs text-muted-foreground">
              {origin.city}, {origin.country}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="h-3 w-3 text-green-500" />
              <span>Destination</span>
            </div>
            <p className="text-sm">
              {destination.name} ({destination.code})
            </p>
            <p className="text-xs text-muted-foreground">
              {destination.city}, {destination.country}
            </p>
          </div>
        </div>

        {/* Distance */}
        <div className="pt-3 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Distance</span>
            <Badge variant="outline">
              {distanceMiles.toLocaleString()} miles
            </Badge>
          </div>
        </div>

        {/* Same city warning */}
        {sameCity && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Both airports are in the same city. Commercial flights are
              typically not available for this route.
            </AlertDescription>
          </Alert>
        )}

        {/* Recommendation */}
        {recommendation && !sameCity && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {recommendation}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
