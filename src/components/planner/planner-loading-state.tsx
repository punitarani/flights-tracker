import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface PlannerLoadingStateProps {
  message?: string;
}

export function PlannerLoadingState({ message }: PlannerLoadingStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex items-center gap-3 py-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">
            {message || "Planning your perfect trip..."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
