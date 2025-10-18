import { Calendar, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PricePoint {
  date: string;
  price: number;
}

interface PriceChartUIProps {
  route: string;
  prices: PricePoint[];
  cheapestPrice?: number;
  cheapestDate?: string;
  averagePrice?: number;
}

/**
 * AI-Generated Server Component: Price Chart
 * Visual bar chart showing price trends across dates
 */
export function PriceChartUI({
  route,
  prices,
  cheapestPrice,
  cheapestDate,
  averagePrice,
}: PriceChartUIProps) {
  if (!prices || prices.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            No price data available
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxPrice = Math.max(...prices.map((p) => p.price));
  const minPrice = Math.min(...prices.map((p) => p.price));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingDown className="h-4 w-4 text-green-600" />
          Price Trends: {route}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Price bars */}
        <div className="space-y-1.5">
          {prices.slice(0, 10).map((entry) => {
            const percentage =
              ((entry.price - minPrice) / (maxPrice - minPrice || 1)) * 100;
            const isLowest = entry.date === cheapestDate;

            return (
              <div key={entry.date} className="flex items-center gap-2 text-sm">
                <span className="flex items-center gap-1 w-28 text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {entry.date}
                </span>
                <div className="flex-1 h-7 bg-muted/30 rounded-sm overflow-hidden relative">
                  <div
                    className={`h-full transition-all ${
                      isLowest ? "bg-green-500" : "bg-primary/60"
                    }`}
                    style={{ width: `${percentage}%`, minWidth: "24px" }}
                  />
                </div>
                <span
                  className={`w-16 text-right font-medium ${
                    isLowest ? "text-green-600" : ""
                  }`}
                >
                  ${entry.price}
                </span>
              </div>
            );
          })}
        </div>

        {/* Summary stats */}
        <div className="flex justify-between text-sm pt-3 border-t">
          <div>
            <span className="text-muted-foreground">Cheapest:</span>
            <span className="ml-2 font-semibold text-green-600">
              ${cheapestPrice || minPrice}
            </span>
          </div>
          {averagePrice && (
            <div>
              <span className="text-muted-foreground">Average:</span>
              <span className="ml-2 font-semibold">${averagePrice}</span>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Highest:</span>
            <span className="ml-2 font-semibold">${maxPrice}</span>
          </div>
        </div>

        {cheapestDate && (
          <div className="pt-2 border-t">
            <Badge variant="default" className="bg-green-600">
              Best Deal: {cheapestDate} at ${cheapestPrice}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
