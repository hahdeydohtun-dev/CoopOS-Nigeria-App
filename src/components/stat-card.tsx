import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  loading = false,
  unavailable = false,
}: {
  label: string;
  value?: string | number | undefined;
  hint?: string | undefined;
  icon: LucideIcon;
  loading?: boolean;
  unavailable?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="h-7 w-24" />
          ) : (
            <p
              className={cn(
                "truncate text-2xl font-semibold tabular-nums",
                unavailable && "text-base font-normal text-muted-foreground",
              )}
            >
              {unavailable ? "Not yet available" : value}
            </p>
          )}
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary">
          <Icon className="size-4 text-secondary-foreground" aria-hidden="true" />
        </div>
      </CardContent>
    </Card>
  );
}
