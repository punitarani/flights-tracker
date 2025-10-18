"use client";

import { TrendingDown } from "lucide-react";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PriceChartData } from "@/server/schemas/planner-view";

interface PriceChartProps {
  data: PriceChartData;
  onClick?: () => void;
}

/**
 * Simple price chart component
 * Shows price trend with visual indicator
 */
export function PriceChart({ data, onClick }: PriceChartProps) {
  const { minPrice, maxPrice, avgPrice } = useMemo(() => {
    const prices = data.data.map((d) => d.price);
    return {
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      avgPrice: prices.reduce((sum, p) => sum + p, 0) / prices.length,
    };
  }, [data]);

  const hasClick = Boolean(onClick);

  return (
    <Card
      className={`transition-all ${hasClick ? "cursor-pointer hover:border-primary/50 hover:shadow-md" : ""}`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrendingDown className="h-4 w-4 text-green-600" />
          Price Trends - {data.route}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Price bars visualization */}
        <div className="space-y-1.5">
          {data.data.slice(0, 10).map((entry) => {
            const percentage =
              ((entry.price - minPrice) / (maxPrice - minPrice)) * 100;
            const isLowest = entry.date === data.cheapestDate;

            return (
              <div key={entry.date} className="flex items-center gap-2 text-xs">
                <span className="w-20 text-muted-foreground">{entry.date}</span>
                <div className="flex-1 h-6 bg-muted/30 rounded-sm overflow-hidden relative">
                  <div
                    className={`h-full transition-all ${
                      isLowest ? "bg-green-500" : "bg-primary/60"
                    }`}
                    style={{ width: `${percentage}%`, minWidth: "20px" }}
                  />
                </div>
                <span
                  className={`w-16 text-right font-medium ${isLowest ? "text-green-600" : ""}`}
                >
                  ${entry.price}
                </span>
              </div>
            );
          })}
        </div>

        {/* Summary stats */}
        <div className="flex justify-between text-xs pt-2 border-t">
          <div>
            <span className="text-muted-foreground">Cheapest:</span>
            <span className="ml-1 font-semibold text-green-600">
              ${minPrice}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Average:</span>
            <span className="ml-1 font-semibold">${Math.round(avgPrice)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Highest:</span>
            <span className="ml-1 font-semibold">${maxPrice}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
