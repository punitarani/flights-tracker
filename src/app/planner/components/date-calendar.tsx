import { Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DatePrice } from "../types";

interface DateCalendarProps {
  dates: DatePrice[];
  cheapestPrice?: number;
  onSelectDate?: (date: DatePrice) => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function DateCalendar({
  dates,
  cheapestPrice,
  onSelectDate,
}: DateCalendarProps) {
  if (dates.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>No dates found in this range.</p>
      </div>
    );
  }

  // Sort dates by price
  const sortedDates = [...dates].sort((a, b) => a.price - b.price);
  const minPrice = sortedDates[0]?.price ?? 0;
  const maxPrice = sortedDates[sortedDates.length - 1]?.price ?? 0;

  return (
    <div className="space-y-4">
      {cheapestPrice && (
        <div className="flex items-center gap-2">
          <Badge variant="default" className="text-sm">
            Best Price: ${cheapestPrice}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {dates.length} {dates.length === 1 ? "date" : "dates"} available
          </span>
        </div>
      )}

      <div className="grid gap-3">
        {sortedDates.slice(0, 20).map((datePrice, index) => {
          const isCheapest = datePrice.price === cheapestPrice;
          const priceRatio =
            maxPrice > minPrice
              ? (datePrice.price - minPrice) / (maxPrice - minPrice)
              : 0;

          // Color coding: green (cheap) to yellow to red (expensive)
          let priceColor = "bg-muted";
          if (priceRatio < 0.33) {
            priceColor =
              "bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800";
          } else if (priceRatio < 0.66) {
            priceColor =
              "bg-yellow-100 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800";
          } else {
            priceColor =
              "bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800";
          }

          return (
            <Card
              key={`${datePrice.date}-${index}`}
              className={`${isCheapest ? "ring-2 ring-primary" : ""}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex items-center justify-center w-12 h-12 rounded-lg ${priceColor}`}
                    >
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-medium">
                        {datePrice.departureDate && datePrice.returnDate ? (
                          <div className="text-sm">
                            <div>
                              {formatDateShort(datePrice.departureDate)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Return: {formatDateShort(datePrice.returnDate)}
                            </div>
                          </div>
                        ) : (
                          formatDate(datePrice.date)
                        )}
                      </div>
                      {isCheapest && (
                        <Badge variant="default" className="text-xs mt-1">
                          Best Price
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        ${datePrice.price}
                      </div>
                      {datePrice.price !== minPrice && (
                        <div className="text-xs text-muted-foreground">
                          +${datePrice.price - minPrice}
                        </div>
                      )}
                    </div>

                    {onSelectDate && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectDate(datePrice)}
                      >
                        Select
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {dates.length > 20 && (
        <div className="text-sm text-muted-foreground text-center">
          Showing top 20 of {dates.length} dates
        </div>
      )}
    </div>
  );
}
