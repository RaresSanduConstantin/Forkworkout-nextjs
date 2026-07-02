"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { format } from "date-fns";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { CompletedWorkout } from "@/lib/types";

type Metric = "volume" | "time" | "reps";

const METRICS: Record<
  Metric,
  { label: string; unit: string; value: (e: CompletedWorkout) => number }
> = {
  volume: { label: "Volume", unit: "kg", value: (e) => e.volume ?? 0 },
  time: { label: "Time", unit: "min", value: (e) => Math.round((e.durationSec ?? 0) / 60) },
  reps: { label: "Reps", unit: "reps", value: (e) => e.totalReps ?? 0 },
};

/**
 * Bar chart of a chosen metric (volume / time / reps) per completed workout.
 * Shows once there's at least one completed workout; metrics with no data are
 * still navigable and render a "No data" state.
 */
export function VolumeChart({ entries }: { entries: CompletedWorkout[] }) {
  const [metric, setMetric] = React.useState<Metric>("volume");

  const cfg = METRICS[metric];

  const data = React.useMemo(
    () =>
      entries
        .filter((e) => cfg.value(e) > 0)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-12)
        .map((e) => ({
          label: format(new Date(e.date), "MMM d"),
          value: cfg.value(e),
          title: e.title,
        })),
    [entries, cfg]
  );

  const chartConfig = {
    value: { label: `${cfg.label} (${cfg.unit})`, color: "var(--chart-1)" },
  } satisfies ChartConfig;

  // Only show once there's at least one completed workout.
  if (entries.length === 0) return null;

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Progress</CardTitle>
            <CardDescription>
              {data.length > 0
                ? `${total.toLocaleString()} ${cfg.unit} across ${data.length} ${
                    data.length === 1 ? "session" : "sessions"
                  }`
                : `No ${cfg.label.toLowerCase()} recorded yet`}
            </CardDescription>
          </div>
          <ToggleGroup
            type="single"
            value={metric}
            onValueChange={(v) => v && setMetric(v as Metric)}
            variant="outline"
            size="sm"
          >
            {(Object.keys(METRICS) as Metric[]).map((m) => (
              <ToggleGroupItem
                key={m}
                value={m}
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                {METRICS[m].label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <BarChart accessibilityLayer data={data} margin={{ left: 4, right: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis width={44} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="var(--color-value)" radius={6} />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[220px] flex-col items-center justify-center gap-1 text-center">
            <p className="text-lg font-semibold text-muted-foreground">No data</p>
            <p className="text-sm text-muted-foreground">
              No {cfg.label.toLowerCase()} recorded yet for your workouts.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
