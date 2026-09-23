"use client";

import * as React from "react";
import { format } from "date-fns";
import { BarChart3, Scale } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dayKeyToDate } from "@/lib/date/day-key";
import { nutritionProgressSummary } from "@/lib/nutrition/progress";
import { resolveNutritionTargetsForDay } from "@/lib/nutrition/target-plans";
import type {
  NutritionEntry,
  NutritionTargetHistoryEntry,
  NutritionTargets,
} from "@/lib/nutrition/types";
import type { BodyMetricEntry } from "@/lib/types";

const number = (value: number) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value);

function targetForDay(
  dayKey: string,
  current: NutritionTargets | null,
  history: NutritionTargetHistoryEntry[]
): NutritionTargets | null {
  if (history.length === 0) return current;
  const active = [...history].reverse().find((entry) => entry.effectiveFrom <= dayKey);
  return active ?? null;
}

export function NutritionProgressCard({
  entries,
  endDayKey,
  targets,
  targetHistory,
  bodyMetrics,
  trainingDayKeys,
}: {
  entries: NutritionEntry[];
  endDayKey: string;
  targets: NutritionTargets | null;
  targetHistory: NutritionTargetHistoryEntry[];
  bodyMetrics: BodyMetricEntry[];
  trainingDayKeys: Set<string>;
}) {
  const [days, setDays] = React.useState<7 | 30>(7);
  const summary = React.useMemo(
    () =>
      nutritionProgressSummary(entries, endDayKey, days, (dayKey) =>
        resolveNutritionTargetsForDay(
          targetForDay(dayKey, targets, targetHistory),
          trainingDayKeys.has(dayKey)
        )
      ),
    [days, endDayKey, entries, targetHistory, targets, trainingDayKeys]
  );
  const weights = React.useMemo(
    () =>
      bodyMetrics.filter(
        (entry) =>
          entry.weightKg !== undefined &&
          entry.dayKey &&
          entry.dayKey >= summary.startDayKey &&
          entry.dayKey <= summary.endDayKey
      ),
    [bodyMetrics, summary.endDayKey, summary.startDayKey]
  );
  const weightChange =
    weights.length >= 2
      ? (weights[weights.length - 1].weightKg ?? 0) - (weights[0].weightKg ?? 0)
      : null;

  return (
    <Card className="mt-3 gap-3 py-4">
      <CardHeader className="flex-row items-center justify-between gap-3 px-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm">
            <BarChart3 className="size-4 text-primary" /> Progress
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Through {format(dayKeyToDate(endDayKey), "MMM d")}; averages use logged days.
          </p>
        </div>
        <Tabs value={String(days)} onValueChange={(value) => setDays(value === "30" ? 30 : 7)}>
          <TabsList className="h-8">
            <TabsTrigger value="7" className="text-xs">7 days</TabsTrigger>
            <TabsTrigger value="30" className="text-xs">30 days</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="space-y-3 px-4">
        {summary.loggedDays === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            Log food to start seeing averages and target consistency.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-[11px] text-muted-foreground">Avg calories</p>
                <p className="mt-1 font-semibold tabular-nums">{number(summary.average.caloriesKcal)}</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-[11px] text-muted-foreground">Days logged</p>
                <p className="mt-1 font-semibold tabular-nums">{summary.loggedDays}/{summary.days}</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-[11px] text-muted-foreground">Within ±10%</p>
                <p className="mt-1 font-semibold tabular-nums">
                  {summary.calorieTargetDays ? `${summary.calorieRangeDays}/${summary.calorieTargetDays}` : "—"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Avg P <strong className="text-foreground">{number(summary.average.proteinG)}g</strong></span>
              <span>C <strong className="text-foreground">{number(summary.average.carbsG)}g</strong></span>
              <span>F <strong className="text-foreground">{number(summary.average.fatG)}g</strong></span>
              {summary.proteinTargetDays > 0 && (
                <span>Protein goal <strong className="text-foreground">{summary.proteinReachedDays}/{summary.proteinTargetDays}</strong></span>
              )}
            </div>
            {weightChange !== null && (
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
                <Scale className="size-3.5 text-primary" />
                Weight changed <strong>{weightChange > 0 ? "+" : ""}{number(weightChange)} kg</strong> across {weights.length} weigh-ins in this period.
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
