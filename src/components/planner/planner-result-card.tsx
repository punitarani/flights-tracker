import { CheckCircle2, Plane } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PlannerResultCardProps {
  content: string;
}

export function PlannerResultCard({ content }: PlannerResultCardProps) {
  return (
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
      <CardContent className="prose prose-sm dark:prose-invert max-w-none">
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {content}
        </div>
      </CardContent>
    </Card>
  );
}
