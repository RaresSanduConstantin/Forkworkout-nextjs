"use client";

import * as React from "react";
import { Dumbbell } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MuscleMapView } from "@/components/history/MuscleMapView";
import type { CompletedWorkout } from "@/lib/types";
import { getCachedLibrary, loadExerciseLibrary, type LibraryExercise } from "@/lib/exercises";
import {
  muscleGroupSetCounts,
  totalSets,
  collectWindowExercises,
} from "@/lib/muscle-stats";
import { muscleScores, muscleHighlights } from "@/lib/muscle-map";
import { useMannequinGender } from "@/lib/use-body-gender";

/**
 * Muscle-group training balance: a stylized body heatmap + a ranked bar
 * breakdown of completed working sets per muscle group over a 7- or 30-day
 * window. Uses the exercise library taxonomy (custom exercises included).
 */
export function MuscleInsights({ history }: { history: CompletedWorkout[] }) {
  const [library, setLibrary] = React.useState<LibraryExercise[]>(getCachedLibrary());
  const [days, setDays] = React.useState<number>(7);
  const gender = useMannequinGender();

  React.useEffect(() => {
    let active = true;
    loadExerciseLibrary().then((lib) => {
      if (active) setLibrary(lib);
    });
    return () => {
      active = false;
    };
  }, []);

  const counts = React.useMemo(
    () => muscleGroupSetCounts(history, library, days),
    [history, library, days]
  );
  const highlights = React.useMemo(
    () => muscleHighlights(muscleScores(collectWindowExercises(history, days), library)),
    [history, library, days]
  );
  const total = totalSets(counts);
  const ranked = React.useMemo(() => [...counts].sort((a, b) => b.sets - a.sets), [counts]);
  const maxSets = ranked.length ? ranked[0].sets : 0;

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell className="size-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Muscle balance</h2>
          </div>
          <ToggleGroup
            type="single"
            value={String(days)}
            onValueChange={(v) => v && setDays(Number(v))}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem
              value="7"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              7 days
            </ToggleGroupItem>
            <ToggleGroupItem
              value="30"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              30 days
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {total === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No completed sets in the last {days} days. Finish a workout and your muscle balance will
            show up here.
          </p>
        ) : (
          <>
            <MuscleMapView highlights={highlights} gender={gender} />


            <div className="space-y-2">
              {ranked.map(({ group, sets }) => (
                <div key={group} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-sm font-medium">{group}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-600"
                      style={{ width: `${maxSets > 0 ? (sets / maxSets) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                    {sets} {sets === 1 ? "set" : "sets"}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              {total} completed working {total === 1 ? "set" : "sets"} in the last {days} days.
              Warm-ups excluded.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
