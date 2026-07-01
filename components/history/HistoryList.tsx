"use client";

import * as React from "react";
import { format, isToday, isYesterday } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CompletedWorkout } from "@/lib/types";
import { dayKeyToDate } from "@/lib/date/day-key";

type DayGroup = {
  dayKey: string;
  date: Date;
  entries: CompletedWorkout[];
};

function labelForDate(date: Date) {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEE, MMM d, yyyy");
}

/** Grouped list of completed workouts, most recent first. */
export function HistoryList({ entries }: { entries: CompletedWorkout[] }) {
  const groups = React.useMemo<DayGroup[]>(() => {
    const byDay = new Map<string, CompletedWorkout[]>();
    for (const entry of entries) {
      const key = entry.dayKey ?? entry.date.slice(0, 10);
      const list = byDay.get(key) ?? [];
      list.push(entry);
      byDay.set(key, list);
    }
    return [...byDay.entries()]
      .map(([dayKey, list]) => ({ dayKey, date: dayKeyToDate(dayKey), entries: list }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [entries]);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.dayKey} className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            {labelForDate(group.date)}
          </h3>
          <ul className="space-y-2">
            {group.entries.map((entry, i) => (
              <li key={`${group.dayKey}-${i}`}>
                <Card>
                  <CardContent className="flex items-center justify-between gap-3 p-3">
                    <span className="min-w-0 break-words font-medium">
                      {entry.title}
                    </span>
                    <Badge variant="secondary">Completed</Badge>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
