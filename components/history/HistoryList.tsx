"use client";

import * as React from "react";
import { format, isToday, isYesterday } from "date-fns";
import { Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
export function HistoryList({
  entries,
  onDelete,
}: {
  entries: CompletedWorkout[];
  onDelete: (entry: CompletedWorkout) => void;
}) {
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
                  <CardContent className="flex items-center justify-between gap-2 p-3">
                    <span className="min-w-0 break-words font-medium">
                      {entry.title}
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      {entry.volume ? (
                        <span className="text-xs text-muted-foreground">
                          {entry.volume.toLocaleString()} kg
                        </span>
                      ) : null}
                      <Badge variant="secondary">Completed</Badge>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Delete ${entry.title} from history`}
                        onClick={() => onDelete(entry)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
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
