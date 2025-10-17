"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Plane,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlanner } from "@/hooks/use-planner";
import { PlannerPromptForm } from "./planner-prompt-form";

export function PlannerShell() {
  const {
    prompt,
    status,
    result,
    error,
    isPlanning,
    canSubmit,
    setPrompt,
    submitPrompt,
    reset,
  } = usePlanner();

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      {/* Header */}
      <div className="space-y-2 text-center">
        <h1 className="text-4xl font-bold tracking-tight">AI Flight Planner</h1>
        <p className="text-muted-foreground">
          Your AI concierge to find the perfect flights
        </p>
      </div>

      {/* Prompt Form */}
      <PlannerPromptForm
        value={prompt}
        onChange={setPrompt}
        onSubmit={submitPrompt}
        isPlanning={isPlanning}
        canSubmit={canSubmit}
      />

      {/* Loading State */}
      {isPlanning && (
        <Card className="border-dashed">
          <CardContent className="flex items-center gap-3 py-6">
            <Clock className="h-5 w-5 animate-pulse text-primary" />
            <p className="text-sm text-muted-foreground">
              Planning your perfect trip...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && status === "success" && (
        <div className="space-y-4">
          {/* Summary Card */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span>Flight Plan Ready</span>
                <Badge variant="secondary" className="ml-auto">
                  <Plane className="mr-1 h-3 w-3" />
                  AI Recommended
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {result.summary}
              </p>
            </CardContent>
          </Card>

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Recommended Flights</h3>
              {result.recommendations.map((rec, idx) => (
                <Card
                  key={`${rec.origin}-${rec.destination}-${rec.departureDate}-${idx}`}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {rec.origin} → {rec.destination}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {rec.stops === 0
                              ? "Non-stop"
                              : `${rec.stops} stop${rec.stops > 1 ? "s" : ""}`}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {rec.departureDate}
                          {rec.returnDate && ` - ${rec.returnDate}`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {Math.floor(rec.duration / 60)}h {rec.duration % 60}m
                          • {rec.airlines.join(", ")}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">
                          ${rec.price}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {rec.currency}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Reset Button */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={reset}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Plan Another Trip
            </Button>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="space-y-4">
          <Card className="border-destructive/50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">
                    Planning Failed
                  </p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={reset}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* Tips */}
      {status === "idle" && (
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <p className="font-medium text-sm mb-2">Tips for better results:</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Include origin and destination cities or airport codes</li>
              <li>• Specify your travel dates or time frame</li>
              <li>• Mention your budget if you have one</li>
              <li>• Add preferences like non-stop flights or airlines</li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
