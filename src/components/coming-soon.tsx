import { Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ComingSoon({
  title,
  description,
  capabilities = [],
}: {
  title: string;
  description?: string;
  capabilities?: string[];
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-4 px-6 py-14 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Construction className="size-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <Badge variant="secondary">Coming in next phase</Badge>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mx-auto max-w-prose text-sm text-muted-foreground">
            {description ??
              "This module is not implemented yet. The database foundation is in place, but no functionality is available here — nothing on this screen is simulated."}
          </p>
        </div>
        {capabilities.length > 0 && (
          <ul className="mx-auto grid max-w-md gap-1 text-left text-sm text-muted-foreground">
            {capabilities.map((c) => (
              <li key={c} className="flex gap-2">
                <span aria-hidden="true">•</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
