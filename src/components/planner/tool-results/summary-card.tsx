"use client";

import { ArrowRight, Calendar, DollarSign, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BestDeal {
  route: string;
  origin: string;
  destination: string;
  price: number;
  date: string;
  savings?: number;
}

interface SummaryCardProps {
  title?: string;
  bestDeals: BestDeal[];
  totalSearched?: number;
  onSelectDeal?: (deal: BestDeal) => void;
}

/**
 * Summary card for multi-tool aggregated results
 * Shows best deals and comparisons from multiple searches
 */
export function SummaryCard({
  title = "Best Deals Found",
  bestDeals,
  totalSearched,
  onSelectDeal,
}: SummaryCardProps) {
  if (!bestDeals || bestDeals.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            No deals available yet
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-yellow-500/20 bg-yellow-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-yellow-600" />
          {title}
          {totalSearched && (
            <Badge variant="secondary" className="ml-auto">
              {totalSearched} routes searched
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {bestDeals.map((deal, idx) => (
          <Card
            key={`${deal.route}-${deal.date}-${idx}`}
            className="hover:border-primary/50 transition-colors"
          >
            <CardContent className="pt-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{deal.origin}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-semibold">{deal.destination}</span>
                  </div>

                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {deal.date}
                    </span>
                    {deal.savings && (
                      <Badge
                        variant="outline"
                        className="text-green-600 border-green-600"
                      >
                        Save ${deal.savings}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="text-right space-y-2">
                  <div className="flex items-center gap-1 text-2xl font-bold text-green-600">
                    <DollarSign className="h-5 w-5" />
                    {deal.price}
                  </div>
                  {onSelectDeal && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => onSelectDeal(deal)}
                    >
                      Select
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}
