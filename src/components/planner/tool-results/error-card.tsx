"use client";

import { AlertCircle, RefreshCcw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ErrorCardProps {
  toolName: string;
  error: string;
  onRetry?: () => void;
}

/**
 * Error card for failed tool executions
 * Shows error message with retry option and helpful suggestions
 */
export function ErrorCard({ toolName, error, onRetry }: ErrorCardProps) {
  const suggestions: Record<string, string> = {
    analyzeRoute:
      "Please verify the airport codes are correct (3 letters, e.g., SFO, LAX)",
    searchCalendarPrices:
      "Try adjusting the date range or check if the airports are valid",
    searchFlightDetails:
      "This route may not have flights available on the selected date",
  };

  const suggestion =
    suggestions[toolName] || "Please try again or modify your search";

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardContent className="pt-6">
        <Alert variant="destructive" className="border-0 bg-transparent p-0">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-sm font-semibold">
            Tool Error: {toolName}
          </AlertTitle>
          <AlertDescription className="text-sm mt-2 space-y-3">
            <p>{error}</p>
            <p className="text-xs text-muted-foreground">{suggestion}</p>
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={onRetry}
              >
                <RefreshCcw className="h-3 w-3 mr-2" />
                Retry
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
