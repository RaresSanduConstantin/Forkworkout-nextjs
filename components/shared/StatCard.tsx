import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Compact stat/metric card for dashboards (e.g. streak, total workouts). */
export function StatCard({
  label,
  value,
  icon,
  info,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  icon?: React.ReactNode;
  info?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("py-0", className)}>
      <CardContent className="flex items-center gap-3 p-4">
        {icon ? (
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <span className="truncate">{label}</span>
            {info}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
