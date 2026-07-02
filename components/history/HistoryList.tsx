"use client";

import * as React from "react";
import { format, isToday, isYesterday } from "date-fns";
import { Trash2, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { CompletedWorkout } from "@/lib/types";
import { dayKeyToDate } from "@/lib/date/day-key";
import { formatClock, formatSetValue, setTypeShort } from "@/lib/workout";
import { ExerciseProgressDialog } from "@/components/history/ExerciseProgressDialog";

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

function EntryCard({
  entry,
  onDelete,
  onSelectExercise,
}: {
  entry: CompletedWorkout;
  onDelete: (entry: CompletedWorkout) => void;
  onSelectExercise: (name: string) => void;
}) {
  const meta = [
    entry.durationSec ? formatClock(entry.durationSec) : null,
    entry.volume ? `${entry.volume.toLocaleString()} kg` : null,
    entry.exercises ? `${entry.exercises.length} exercises` : null,
    entry.rpe ? `RPE ${entry.rpe}` : null,
  ].filter(Boolean);

  return (
    <Card className="overflow-hidden py-0">
      <Accordion type="single" collapsible>
        <AccordionItem value={entry.date} className="border-0">
          <div className="flex items-center">
            <AccordionTrigger className="flex-1 px-3 py-3 hover:no-underline">
              <div className="flex min-w-0 flex-1 flex-col items-start pr-2 text-left">
                <span className="break-words font-medium">{entry.title}</span>
                {meta.length > 0 && (
                  <span className="text-xs text-muted-foreground">{meta.join(" · ")}</span>
                )}
              </div>
            </AccordionTrigger>
            <Button
              variant="ghost"
              size="icon-sm"
              className="mr-2 shrink-0 text-muted-foreground hover:text-destructive"
              aria-label={`Delete ${entry.title} from history`}
              onClick={() => onDelete(entry)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <AccordionContent className="px-3 pb-3">
            {entry.exercises && entry.exercises.length > 0 ? (
              <ul className="space-y-3">
                {entry.exercises.map((ex, exIdx) => (
                  <li key={exIdx}>
                    {ex.name ? (
                      <button
                        type="button"
                        onClick={() => onSelectExercise(ex.name)}
                        className="mb-1 inline-flex items-center gap-1 text-sm font-medium underline-offset-2 hover:underline"
                      >
                        {ex.name}
                        <TrendingUp className="size-3.5 text-primary" aria-hidden />
                      </button>
                    ) : (
                      <div className="mb-1 text-sm font-medium">Exercise</div>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {ex.sets.map((s, sIdx) => (
                        <Badge
                          key={sIdx}
                          variant={
                            s.status === "done"
                              ? "default"
                              : s.status === "skipped"
                              ? "outline"
                              : "secondary"
                          }
                          className="font-normal"
                        >
                          {s.reps} × {formatSetValue(s.value, s.unit)}
                          {setTypeShort(s.type) ? ` · ${setTypeShort(s.type)}` : ""}
                          {s.status === "skipped" ? " (skipped)" : ""}
                        </Badge>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Exercise details weren&apos;t recorded for this workout.
              </p>
            )}
            {entry.notes && (
              <p className="mt-3 rounded-md bg-muted/60 px-3 py-2 text-sm italic text-muted-foreground">
                “{entry.notes}”
              </p>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}

/** Grouped list of completed workouts, most recent first. Each expands to detail. */
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

  const [selectedExercise, setSelectedExercise] = React.useState<string | null>(null);

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
                <EntryCard
                  entry={entry}
                  onDelete={onDelete}
                  onSelectExercise={setSelectedExercise}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
      <ExerciseProgressDialog
        name={selectedExercise}
        onOpenChange={(open) => !open && setSelectedExercise(null)}
      />
    </div>
  );
}
