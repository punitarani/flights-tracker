"use client";

import { Lightbulb, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Insight {
  type: "tip" | "warning" | "info";
  title: string;
  description: string;
}

interface InsightsCardProps {
  route?: string;
  insights: Insight[];
}

/**
 * Insights card for AI recommendations and travel tips
 * Displays personalized suggestions based on search context
 */
export function InsightsCard({ route, insights }: InsightsCardProps) {
  if (!insights || insights.length === 0) {
    return null;
  }

  return (
    <Card className="border-blue-500/20 bg-blue-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4 text-blue-600" />
          Travel Insights
          {route && (
            <span className="text-sm text-muted-foreground font-normal">
              for {route}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((insight, idx) => (
          <div
            key={`${insight.type}-${insight.title}-${idx}`}
            className="flex gap-3 p-3 rounded-lg bg-background border"
          >
            <div className="shrink-0 mt-0.5">
              {insight.type === "tip" && (
                <TrendingUp className="h-4 w-4 text-green-600" />
              )}
              {insight.type === "warning" && (
                <Badge variant="destructive" className="h-4 w-4 p-0">
                  !
                </Badge>
              )}
              {insight.type === "info" && (
                <Lightbulb className="h-4 w-4 text-blue-600" />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">{insight.title}</p>
              <p className="text-xs text-muted-foreground">
                {insight.description}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
