"use client";

import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ComparisonView } from "@/server/schemas/planner-view";

interface ComparisonViewProps {
  view: ComparisonView;
}

/**
 * Comparison view component
 * Shows side-by-side route comparison with price data
 */
export function ComparisonViewComponent({ view }: ComparisonViewProps) {
  return (
    <div className="flex h-full w-full flex-col overflow-auto p-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">Route Comparison</h2>
          <p className="text-sm text-muted-foreground">
            Comparing {view.routes.length} routes
          </p>
        </div>

        {/* Routes */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {view.routes.map((route) => {
            const priceInfo = view.priceData.find(
              (p) =>
                p.route === `${route.origin.code}-${route.destination.code}`,
            );

            return (
              <Card key={`${route.origin.code}-${route.destination.code}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span>{route.origin.code}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <span>{route.destination.code}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1 text-sm">
                    <p className="text-muted-foreground">
                      {route.origin.city} → {route.destination.city}
                    </p>
                    {route.distanceMiles && (
                      <p className="text-xs text-muted-foreground">
                        {Math.round(route.distanceMiles).toLocaleString()} miles
                      </p>
                    )}
                  </div>

                  {priceInfo && (
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Cheapest:
                        </span>
                        <span className="font-semibold text-green-600">
                          ${priceInfo.minPrice}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Average:
                        </span>
                        <span className="font-semibold">
                          ${priceInfo.avgPrice}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Highest:
                        </span>
                        <span className="font-semibold text-orange-600">
                          ${priceInfo.maxPrice}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Price Summary */}
        {view.priceData.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Price Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {view.priceData.map((data) => {
                  const spread = data.maxPrice - data.minPrice;
                  const spreadPercent = (spread / data.avgPrice) * 100;

                  return (
                    <div
                      key={data.route}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="font-medium">{data.route}</span>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={
                            spreadPercent > 50 ? "destructive" : "secondary"
                          }
                          className="gap-1"
                        >
                          {spreadPercent > 50 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {Math.round(spreadPercent)}% spread
                        </Badge>
                        <span className="font-semibold">${data.avgPrice}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
