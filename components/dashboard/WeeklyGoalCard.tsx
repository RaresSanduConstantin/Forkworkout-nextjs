"use client";

import * as React from "react";
import { CalendarCheck, Check, Minus, Plus, Target } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getCompletedDayKeys } from "@/lib/storage/history-storage";
import { currentWeekDayKeys } from "@/lib/date/day-key";
import { getSettings, updateSettings } from "@/lib/storage/settings";

/**
 * Dashboard card that tracks distinct workout days in the current calendar week
 * (Mon–Sun) against a user-set weekly goal. The goal is editable inline (tap
 * "Goal") and persisted via the settings store. All storage reads happen after
 * mount to avoid hydration mismatches.
 */
export function WeeklyGoalCard() {
  const [goal, setGoal] = React.useState(3);
  const [thisWeek, setThisWeek] = React.useState(0);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    setGoal(getSettings().weeklyGoal);

    const dayKeys = getCompletedDayKeys();
    const week = currentWeekDayKeys();
    setThisWeek(dayKeys.filter((k) => week.has(k)).length);
    setLoaded(true);
  }, []);

  const changeGoal = (next: number) => {
    const clamped = Math.min(7, Math.max(1, next));
    setGoal(clamped);
    updateSettings({ weeklyGoal: clamped });
  };

  const met = loaded && thisWeek >= goal;
  const pct = goal > 0 ? Math.min(100, (thisWeek / goal) * 100) : 0;

  return (
    <Card className="py-0">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                "flex size-10 items-center justify-center rounded-lg",
                met ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
              )}
            >
              {met ? <Check className="size-5" /> : <CalendarCheck className="size-5" />}
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-bold leading-none">
                {thisWeek}
                <span className="text-base font-medium text-muted-foreground">/{goal}</span>
              </div>
              <div className="mt-1 truncate text-xs text-muted-foreground">
                {met ? "Weekly goal reached! \uD83C\uDF89" : "Workouts this week"}
              </div>
            </div>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                <Target className="size-4" />
                Goal
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
              <p className="text-sm font-medium">Weekly goal</p>
              <p className="mb-3 text-xs text-muted-foreground">How many days per week?</p>
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => changeGoal(goal - 1)}
                  disabled={goal <= 1}
                  aria-label="Decrease weekly goal"
                >
                  <Minus className="size-4" />
                </Button>
                <span className="text-2xl font-bold tabular-nums">
                  {goal}
                  <span className="text-sm font-medium text-muted-foreground"> / week</span>
                </span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => changeGoal(goal + 1)}
                  disabled={goal >= 7}
                  aria-label="Increase weekly goal"
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <Progress
          value={pct}
          className="mt-3"
          aria-label={`${thisWeek} of ${goal} workouts this week`}
        />
      </CardContent>
    </Card>
  );
}
