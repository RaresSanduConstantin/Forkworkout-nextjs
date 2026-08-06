"use client";

import * as React from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { format } from "date-fns";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { CompletedWorkout, SetUnit } from "@/lib/types";
import { getExerciseHistory, type ExerciseSessionStat } from "@/lib/history-stats";
import { applyProgressRange, type ProgressRange } from "@/lib/progress-range";

type Metric = {
  label: string;
  unit: string;
  value: (session: ExerciseSessionStat) => number;
};

const METRICS_BY_KIND: Record<SetUnit, Metric[]> = {
  kg: [
    { label: "Top set", unit: "kg", value: (session) => Math.round(session.topWeightKg * 10) / 10 },
    { label: "Est 1RM", unit: "kg", value: (session) => Math.round(session.bestOneRepMax) },
    { label: "Volume", unit: "kg", value: (session) => Math.round(session.volumeKg) },
  ],
  bw: [{ label: "Reps", unit: "reps", value: (session) => session.bestReps }],
  time: [{ label: "Duration", unit: "s", value: (session) => session.bestDurationSec }],
  km: [{ label: "Distance", unit: "km", value: (session) => session.bestDistanceKm }],
};

/** Reusable progress graph for one exercise, used inline and in the history dialog. */
export function ExerciseProgressChart({
  name,
  history,
  range = "all",
}: {
  name: string;
  history?: CompletedWorkout[];
  range?: ProgressRange;
}) {
  const allStats = React.useMemo(
    () => getExerciseHistory(name, history),
    [name, history]
  );
  const stats = React.useMemo(
    () => applyProgressRange(allStats, range),
    [allStats, range]
  );
  const kind = allStats.length ? allStats[allStats.length - 1].kind : "kg";
  const metrics = METRICS_BY_KIND[kind];
  const [metricIdx, setMetricIdx] = React.useState(0);

  React.useEffect(() => setMetricIdx(0), [name, kind]);

  const metric = metrics[Math.min(metricIdx, metrics.length - 1)];
  const data = React.useMemo(
    () =>
      stats.map((session) => ({
        label: format(
          new Date(session.date),
          range === "all" ? "MMM d, yyyy" : "MMM d"
        ),
        value: metric.value(session),
      })),
    [stats, metric, range]
  );
  const hasData = data.some((point) => point.value > 0);
  const chartConfig = {
    value: { label: `${metric.label} (${metric.unit})`, color: "var(--chart-1)" },
  } satisfies ChartConfig;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {stats.length} {stats.length === 1 ? "session" : "sessions"} shown
        </p>
        {metrics.length > 1 && (
          <ToggleGroup
            type="single"
            value={String(metricIdx)}
            onValueChange={(value) => value && setMetricIdx(parseInt(value, 10))}
            variant="outline"
            size="sm"
          >
            {metrics.map((candidate, index) => (
              <ToggleGroupItem
                key={candidate.label}
                value={String(index)}
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                {candidate.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </div>

      {hasData ? (
        <ChartContainer config={chartConfig} className="h-[240px] w-full min-w-0">
          <LineChart accessibilityLayer data={data} margin={{ left: 4, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
            />
            <YAxis width={40} tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              dataKey="value"
              type="monotone"
              stroke="var(--color-value)"
              strokeWidth={2}
              dot={data.length <= 24 ? { r: 3 } : false}
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
    </div>
  );
}
