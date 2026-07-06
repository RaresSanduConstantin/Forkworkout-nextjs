"use client";

import * as React from "react";
import { Flame, CalendarCheck, Trophy } from "lucide-react";
import { StatCard } from "@/components/shared/StatCard";
import { getCompletedWorkouts, getCompletedDayKeys } from "@/lib/storage/history-storage";
import { computeStreak } from "@/lib/date/streak";
import { currentWeekDayKeys } from "@/lib/date/day-key";

/** Summary stat cards: current streak, workouts this week, and all-time total. */
export function StreakSummary() {
  const [streak, setStreak] = React.useState(0);
  const [thisWeek, setThisWeek] = React.useState(0);
  const [total, setTotal] = React.useState(0);

  React.useEffect(() => {
    const dayKeys = getCompletedDayKeys();
    setStreak(computeStreak(dayKeys));
    setTotal(getCompletedWorkouts().length);

    // Count distinct workout days in the current calendar week (Mon–Sun).
    const week = currentWeekDayKeys();
    setThisWeek(dayKeys.filter((k) => week.has(k)).length);
  }, []);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatCard label="Day streak" value={streak} icon={<Flame className="size-5" />} />
      <StatCard
        label="This week"
        value={thisWeek}
        icon={<CalendarCheck className="size-5" />}
      />
      <StatCard label="All time" value={total} icon={<Trophy className="size-5" />} />
    </div>
  );
}
