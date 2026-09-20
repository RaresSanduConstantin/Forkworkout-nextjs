"use client";

import * as React from "react";
import { format, isToday, isYesterday } from "date-fns";
import { LineChart, Pencil, Trash2 } from "lucide-react";
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
import { formatClock, formatSetValue, getSetStages, setTypeShort } from "@/lib/workout";
import { ExerciseProgressDialog } from "@/components/history/ExerciseProgressDialog";
import { paginateHistory } from "@/lib/history-pagination";

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
  onEdit,
  onDelete,
  onSelectExercise,
}: {
  entry: CompletedWorkout;
  onEdit: (entry: CompletedWorkout) => void;
  onDelete: (entry: CompletedWorkout) => void;
  onSelectExercise: (name: string) => void;
}) {
  const meta = [
    entry.durationSec ? formatClock(entry.durationSec) : null,
    entry.volume ? `${entry.volume.toLocaleString()} kg` : null,
    entry.exercises ? `${entry.exercises.length} exercises` : null,
    entry.rpe ? `RPE ${entry.rpe}` : null,
    entry.calories ? `${entry.calories.toLocaleString()} kcal` : null,
    entry.avgHeartRate ? `${entry.avgHeartRate} bpm avg` : null,
    entry.maxHeartRate ? `${entry.maxHeartRate} bpm max` : null,
  ].filter(Boolean);

  return (
    <Card className="overflow-hidden py-0">
      <Accordion type="single" collapsible>
        <AccordionItem value={entry.date} className="border-0">
          {/* Relative wrapper: the trigger fills the whole header, while the
              edit/delete actions remain independently tappable. */}
          <div className="relative">
            <AccordionTrigger className="w-full items-center px-3 py-3 pr-24 hover:no-underline data-[state=open]:bg-muted/40 [&>svg]:size-5 [&>svg]:translate-y-0 [&>svg]:text-primary">
              <div className="flex min-w-0 flex-1 flex-col items-start pr-2 text-left">
                <span className="break-words font-medium">{entry.title}</span>
                {meta.length > 0 && (
                  <span className="text-xs text-muted-foreground">{meta.join(" · ")}</span>
                )}
                <span className="mt-0.5 text-xs text-primary/80">Tap to see details</span>
              </div>
            </AccordionTrigger>
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute right-10 top-1/2 z-10 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={`Edit ${entry.title} history entry`}
              onClick={() => onEdit(entry)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 text-muted-foreground hover:text-destructive"
              aria-label={`Delete ${entry.title} from history`}
              onClick={() => onDelete(entry)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <AccordionContent className="px-3 pb-3">
            {entry.exercises && entry.exercises.length > 0 ? (
              <>
                <p className="mb-2 text-xs text-muted-foreground">
                  Tap an exercise to see its progress over time.
                </p>
                <ul className="space-y-3">
                  {entry.exercises.map((ex, exIdx) => (
                    <li key={exIdx}>
                      {ex.name ? (
                        <button
                          type="button"
                          onClick={() => onSelectExercise(ex.name)}
                          className="mb-1.5 inline-flex max-w-full items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          <LineChart className="size-3.5 shrink-0 text-primary" aria-hidden />
                          <span className="truncate">{ex.name}</span>
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
                            className="h-auto max-w-full whitespace-normal text-left font-normal"
                          >
                            {getSetStages(s)
                              .map(
                                (stage) =>
                                  `${stage.reps} × ${formatSetValue(stage.value, stage.unit)}`
                              )
                              .join(" → ")}
                            {setTypeShort(s.type) ? ` · ${setTypeShort(s.type)}` : ""}
                            {s.status === "skipped" ? " (skipped)" : ""}
                          </Badge>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
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
  onEdit,
  onDelete,
}: {
  entries: CompletedWorkout[];
  onEdit: (entry: CompletedWorkout) => void;
  onDelete: (entry: CompletedWorkout) => void;
}) {
  const [page, setPage] = React.useState(1);
  const listTopRef = React.useRef<HTMLDivElement>(null);
  const pageData = React.useMemo(() => paginateHistory(entries, page), [entries, page]);

  React.useEffect(() => {
    if (page !== pageData.page) setPage(pageData.page);
  }, [page, pageData.page]);

  const groups = React.useMemo<DayGroup[]>(() => {
    const byDay = new Map<string, CompletedWorkout[]>();
    for (const entry of pageData.entries) {
      const key = entry.dayKey ?? entry.date.slice(0, 10);
      const list = byDay.get(key) ?? [];
      list.push(entry);
      byDay.set(key, list);
    }
    return [...byDay.entries()]
      .map(([dayKey, list]) => ({ dayKey, date: dayKeyToDate(dayKey), entries: list }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [pageData.entries]);

  const [selectedExercise, setSelectedExercise] = React.useState<string | null>(null);

  const goToPage = (nextPage: number) => {
    setPage(nextPage);
    window.requestAnimationFrame(() => listTopRef.current?.scrollIntoView({ block: "start" }));
  };

  return (
    <div ref={listTopRef} className="scroll-mt-4 space-y-4">
      {groups.map((group) => (
        <div key={group.dayKey} className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            {labelForDate(group.date)}
          </h3>
          <ul className="space-y-2">
            {group.entries.map((entry, i) => (
              <li key={`${entry.date}-${i}`}>
                <EntryCard
                  entry={entry}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onSelectExercise={setSelectedExercise}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
      {pageData.totalPages > 1 && (
        <nav
          className="space-y-2 rounded-lg border bg-muted/30 p-3"
          aria-label="Recent activity pages"
        >
          <p className="text-center text-xs text-muted-foreground" aria-live="polite">
            Showing {pageData.rangeStart}–{pageData.rangeEnd} of {pageData.totalEntries} workouts
          </p>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => goToPage(pageData.page - 1)}
              disabled={pageData.page === 1}
            >
              Previous
            </Button>
            <span className="px-1 text-sm font-medium tabular-nums">
              {pageData.page} / {pageData.totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              onClick={() => goToPage(pageData.page + 1)}
              disabled={pageData.page === pageData.totalPages}
            >
              Next
            </Button>
          </div>
        </nav>
      )}
      <ExerciseProgressDialog
        name={selectedExercise}
        onOpenChange={(open) => !open && setSelectedExercise(null)}
      />
    </div>
  );
}
