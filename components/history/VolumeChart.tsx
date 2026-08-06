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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExerciseProgressChart } from "@/components/history/ExerciseProgressChart";
import type { CompletedWorkout } from "@/lib/types";
import { getAllExerciseNames } from "@/lib/history-stats";
import { applyProgressRange, type ProgressRange } from "@/lib/progress-range";

type Metric = "volume" | "time" | "reps" | "calories" | "avgBpm";
type ProgressView = "overview" | "exercise";

const METRICS: Record<
  Metric,
  { label: string; unit: string; agg: "sum" | "avg"; value: (entry: CompletedWorkout) => number }
> = {
  volume: { label: "Volume", unit: "kg", agg: "sum", value: (entry) => entry.volume ?? 0 },
  time: {
    label: "Time",
    unit: "min",
    agg: "sum",
    value: (entry) => Math.round((entry.durationSec ?? 0) / 60),
  },
  reps: { label: "Reps", unit: "reps", agg: "sum", value: (entry) => entry.totalReps ?? 0 },
  calories: {
    label: "Calories",
    unit: "kcal",
    agg: "sum",
    value: (entry) => entry.calories ?? 0,
  },
  avgBpm: {
    label: "Avg BPM",
    unit: "bpm",
    agg: "avg",
    value: (entry) => entry.avgHeartRate ?? 0,
  },
};

/** Whole-workout and per-exercise progress trends in one history card. */
export function VolumeChart({ entries }: { entries: CompletedWorkout[] }) {
  const [view, setView] = React.useState<ProgressView>("overview");
  const [range, setRange] = React.useState<ProgressRange>("recent");
  const [metric, setMetric] = React.useState<Metric>("volume");
  const [selectedExercise, setSelectedExercise] = React.useState("");
  const cfg = METRICS[metric];

  const allOverviewData = React.useMemo(
    () =>
      entries
        .filter((entry) => cfg.value(entry) > 0)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((entry) => ({
          label: format(new Date(entry.date), range === "all" ? "MMM d, yyyy" : "MMM d"),
          value: cfg.value(entry),
          title: entry.title,
        })),
    [entries, cfg, range]
  );
  const data = React.useMemo(
    () => applyProgressRange(allOverviewData, range),
    [allOverviewData, range]
  );
  const exerciseNames = React.useMemo(() => getAllExerciseNames(entries), [entries]);
  const exerciseName = exerciseNames.includes(selectedExercise)
    ? selectedExercise
    : exerciseNames[0] ?? "";

  const chartConfig = {
    value: { label: `${cfg.label} (${cfg.unit})`, color: "var(--chart-1)" },
  } satisfies ChartConfig;
  if (entries.length === 0) return null;

  const sum = data.reduce((total, point) => total + point.value, 0);
  const headline =
    cfg.agg === "avg"
      ? `${data.length ? Math.round(sum / data.length).toLocaleString() : 0} ${cfg.unit} average`
      : `${sum.toLocaleString()} ${cfg.unit}`;

  return (
    <Card>
      <Tabs value={view} onValueChange={(value) => setView(value as ProgressView)}>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Progress</CardTitle>
              <CardDescription>
                See whole-workout trends or focus on one exercise.
              </CardDescription>
            </div>
            <ToggleGroup
              type="single"
              value={range}
              onValueChange={(value) => value && setRange(value as ProgressRange)}
              variant="outline"
              size="sm"
              aria-label="Progress history range"
            >
              <ToggleGroupItem
                value="recent"
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                12 sessions
              </ToggleGroupItem>
              <ToggleGroupItem
                value="all"
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                All time
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="exercise">Exercise</TabsTrigger>
          </TabsList>
        </CardHeader>

        <CardContent>
          <TabsContent value="overview" className="mt-0 space-y-3">
            <ToggleGroup
              type="single"
              value={metric}
              onValueChange={(value) => value && setMetric(value as Metric)}
              variant="outline"
              size="sm"
              className="w-full overflow-x-auto sm:w-auto"
            >
              {(Object.keys(METRICS) as Metric[]).map((candidate) => (
                <ToggleGroupItem
                  key={candidate}
                  value={candidate}
                  className="flex-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  {METRICS[candidate].label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <p className="text-sm text-muted-foreground">
              {data.length > 0
                ? `${headline} across ${data.length} ${data.length === 1 ? "session" : "sessions"}`
                : `No ${cfg.label.toLowerCase()} recorded yet`}
            </p>

            {data.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[240px] w-full">
                <BarChart accessibilityLayer data={data} margin={{ left: 4, right: 4 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={24}
                  />
                  <YAxis width={44} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="var(--color-value)" radius={6} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[240px] flex-col items-center justify-center gap-1 text-center">
                <p className="text-lg font-semibold text-muted-foreground">No data</p>
                <p className="text-sm text-muted-foreground">
                  No {cfg.label.toLowerCase()} recorded yet for your workouts.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="exercise" className="mt-0 space-y-4">
            {exerciseName ? (
              <>
                <div className="space-y-1.5">
                  <label htmlFor="progress-exercise" className="text-sm font-medium">
                    Exercise
                  </label>
                  <Select value={exerciseName} onValueChange={setSelectedExercise}>
                    <SelectTrigger id="progress-exercise" className="w-full">
                      <SelectValue placeholder="Choose an exercise" />
                    </SelectTrigger>
                    <SelectContent>
                      {exerciseNames.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <ExerciseProgressChart name={exerciseName} history={entries} range={range} />
              </>
            ) : (
              <div className="flex h-[240px] items-center justify-center text-center text-sm text-muted-foreground">
                Complete an exercise to start tracking its progress.
              </div>
            )}
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}
