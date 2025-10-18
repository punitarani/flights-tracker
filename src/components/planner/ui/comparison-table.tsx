"use client";

import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ComparisonTableData } from "@/server/schemas/planner-view";

interface ComparisonTableProps {
  data: ComparisonTableData;
  onClick?: (route: { origin: string; destination: string }) => void;
}

/**
 * Comparison table component
 * Shows side-by-side route comparison
 */
export function ComparisonTable({ data, onClick }: ComparisonTableProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Route Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.routes.map((route) => (
            <button
              key={`${route.origin}-${route.destination}`}
              type="button"
              className={`flex w-full items-center justify-between gap-4 rounded-lg border p-3 text-sm transition-all ${
                onClick
                  ? "cursor-pointer hover:border-primary/50 hover:bg-muted/30"
                  : ""
              }`}
              onClick={() =>
                onClick?.({
                  origin: route.origin,
                  destination: route.destination,
                })
              }
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{route.origin}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{route.destination}</span>
              </div>

              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-xs">
                  {route.stops === 0 ? "Non-stop" : `${route.stops} stop`}
                </Badge>
                <div className="text-right">
                  <div className="font-bold text-primary">
                    ${route.cheapestPrice}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {route.bestDate}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
