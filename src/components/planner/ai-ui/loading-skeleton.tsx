import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface LoadingSkeletonProps {
  toolName: string;
}

/**
 * AI-Generated Server Component: Loading State
 * Shows while tools are executing
 */
export function LoadingSkeleton({ toolName }: LoadingSkeletonProps) {
  const labels: Record<string, string> = {
    analyzeRoute: "Analyzing route...",
    searchCalendarPrices: "Searching prices across dates...",
    searchFlightDetails: "Finding flight details...",
  };

  const label = labels[toolName] || "Processing...";

  return (
    <Card className="border-dashed">
      <CardContent className="flex items-center gap-3 py-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
