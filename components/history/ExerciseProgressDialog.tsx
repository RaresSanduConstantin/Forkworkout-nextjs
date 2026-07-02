"use client";

import * as React from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { format } from "date-fns";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { SetUnit } from "@/lib/types";
import { getExerciseHistory, type ExerciseSessionStat } from "@/lib/history-stats";

type Metric = {
  label: string;
  unit: string;
  value: (s: ExerciseSessionStat) => number;
};

// Which metrics make sense per exercise kind.
const METRICS_BY_KIND: Record<SetUnit, Metric[]> = {
  kg: [
    { label: "Top set", unit: "kg", value: (s) => Math.round(s.topWeightKg * 10) / 10 },
    { label: "Est 1RM", unit: "kg", value: (s) => Math.round(s.bestOneRepMax) },
    { label: "Volume", unit: "kg", value: (s) => Math.round(s.volumeKg) },
  ],
  bw: [{ label: "Reps", unit: "reps", value: (s) => s.bestReps }],
  time: [{ label: "Duration", unit: "s", value: (s) => s.bestDurationSec }],
  km: [{ label: "Distance", unit: "km", value: (s) => s.bestDistanceKm }],
};

/** Progress chart for a single exercise across all completed sessions. */
export function ExerciseProgressDialog({
  name,
  onOpenChange,
}: {
  name: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const stats = React.useMemo(() => (name ? getExerciseHistory(name) : []), [name]);
  const kind = stats.length ? stats[stats.length - 1].kind : "kg";
  const metrics = METRICS_BY_KIND[kind];
  const [metricIdx, setMetricIdx] = React.useState(0);

  // Reset the selected metric whenever the exercise changes.
  React.useEffect(() => setMetricIdx(0), [name]);

  const metric = metrics[Math.min(metricIdx, metrics.length - 1)];

  const data = React.useMemo(
    () =>
      stats.map((s) => ({
        label: format(new Date(s.date), "MMM d"),
        value: metric.value(s),
      })),
    [stats, metric]
  );

  const hasData = data.some((d) => d.value > 0);
  const chartConfig = {
    value: { label: `${metric.label} (${metric.unit})`, color: "var(--chart-1)" },
  } satisfies ChartConfig;

  return (
    <Dialog open={name !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-1rem)] overflow-hidden sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle className="break-words pr-6">{name}</DialogTitle>
          <DialogDescription>
            {stats.length > 0
              ? `${stats.length} ${stats.length === 1 ? "session" : "sessions"} tracked`
              : "No history yet"}
          </DialogDescription>
        </DialogHeader>

        {metrics.length > 1 && (
          <ToggleGroup
            type="single"
            value={String(metricIdx)}
            onValueChange={(v) => v && setMetricIdx(parseInt(v, 10))}
            variant="outline"
            size="sm"
            className="w-full"
          >
            {metrics.map((m, i) => (
              <ToggleGroupItem
                key={m.label}
                value={String(i)}
                className="flex-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                {m.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        {hasData ? (
          <ChartContainer config={chartConfig} className="h-[240px] w-full min-w-0">
            <LineChart accessibilityLayer data={data} margin={{ left: 4, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis width={40} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                dataKey="value"
                type="monotone"
                stroke="var(--color-value)"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[240px] flex-col items-center justify-center gap-1 text-center">
            <p className="text-lg font-semibold text-muted-foreground">No data</p>
            <p className="text-sm text-muted-foreground">
              No {metric.label.toLowerCase()} recorded for this exercise yet.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
