"use client";

import * as React from "react";
import { Target, TrendingDown, TrendingUp, Check, Pencil, X } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NumberInput } from "@/components/ui/number-input";
import { Progress } from "@/components/ui/progress";
import { weightProjection } from "@/lib/body-metrics";
import type { BodyProfile } from "@/lib/storage/profile";

const parseNum = (s: string): number | undefined => {
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/**
 * Goal-weight tracker: set a target weight and see progress from your first
 * logged weight plus an ETA projected from your recent trend.
 */
export function WeightGoalCard({
  profile,
  onChange,
  series,
}: {
  profile: BodyProfile;
  onChange: (patch: Partial<BodyProfile>) => void;
  series: { date: string; weightKg: number }[];
}) {
  const goal = profile.goalWeightKg;
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState("");

  React.useEffect(() => {
    setValue(goal != null ? String(goal) : "");
  }, [goal, editing]);

  const save = () => {
    const g = parseNum(value);
    onChange({ goalWeightKg: g });
    setEditing(false);
  };

  const projection = React.useMemo(() => weightProjection(series, goal), [series, goal]);

  // No goal yet, or actively editing → show the setter.
  if (goal == null || editing) {
    return (
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <Target className="size-4 text-primary" />
            <h2 className="font-semibold">{goal == null ? "Set a goal weight" : "Edit goal weight"}</h2>
          </div>
          <div className="flex items-center gap-2">
            <NumberInput
              decimal
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. 75"
              aria-label="Goal weight in kg"
              className="max-w-32"
            />
            <span className="text-sm text-muted-foreground">kg</span>
            <div className="ml-auto flex gap-2">
              {goal != null && (
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              )}
              <Button size="sm" onClick={save} disabled={!parseNum(value)}>
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className="size-4 text-primary" />
            <h2 className="font-semibold">Goal: {goal} kg</h2>
          </div>
          <div className="flex">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Edit goal"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Clear goal"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onChange({ goalWeightKg: undefined })}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {projection ? (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {projection.start} kg → <span className="font-semibold text-foreground">{projection.current} kg</span>
              </span>
              <span className="font-medium">{Math.round(projection.progressPct)}%</span>
            </div>
            <Progress value={projection.progressPct} aria-label="Progress toward goal weight" />

            <p className="flex items-center gap-1.5 text-sm">
              {projection.reached ? (
                <>
                  <Check className="size-4 text-emerald-500" />
                  <span className="font-medium">Goal reached! 🎉</span>
                </>
              ) : projection.etaWeeks != null ? (
                <>
                  {projection.slopePerWeek < 0 ? (
                    <TrendingDown className="size-4 text-emerald-500" />
                  ) : (
                    <TrendingUp className="size-4 text-emerald-500" />
                  )}
                  <span>
                    ~{projection.etaWeeks} {projection.etaWeeks === 1 ? "week" : "weeks"} to go at{" "}
                    {Math.abs(projection.slopePerWeek)} kg/week
                  </span>
                </>
              ) : (
                <>
                  <TrendingUp className="size-4 text-amber-500" />
                  <span className="text-muted-foreground">
                    {series.length < 2
                      ? "Log more weigh-ins to project your ETA."
                      : "Your recent trend isn't moving toward your goal yet."}
                  </span>
                </>
              )}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Log your weight to track progress toward this goal.</p>
        )}
      </CardContent>
    </Card>
  );
}
