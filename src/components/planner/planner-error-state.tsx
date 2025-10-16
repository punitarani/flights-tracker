import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PlannerErrorStateProps {
  error: string;
}

export function PlannerErrorState({ error }: PlannerErrorStateProps) {
  return (
    <Card className="border-destructive/50">
      <CardContent className="pt-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="ml-2">
            {error || "Failed to plan itinerary. Please try again."}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
