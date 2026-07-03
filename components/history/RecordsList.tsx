"use client";

import * as React from "react";
import { Trophy } from "lucide-react";

import type { CompletedWorkout } from "@/lib/types";
import { getAllExerciseNames, getExercisePR } from "@/lib/history-stats";
import { formatSetValue } from "@/lib/workout";

type RecordRow = { name: string; main: string; sub?: string };

export function buildExerciseRecords(history: CompletedWorkout[]): RecordRow[] {
  const rows: RecordRow[] = [];
  for (const name of getAllExerciseNames(history)) {
    const pr = getExercisePR(name, history);
    if (!pr) continue;

    let main: string | null = null;
    let sub: string | undefined;
    if (pr.kind === "kg" && pr.maxWeightKg > 0) {
      main = `${pr.maxWeightKg} kg × ${pr.maxWeightReps}`;
      if (pr.bestOneRepMax > 0) sub = `Est. 1RM ~${Math.round(pr.bestOneRepMax)} kg`;
    } else if (pr.kind === "bw" && pr.bestReps > 0) {
      main = `${pr.bestReps} reps`;
    } else if (pr.kind === "time" && pr.bestDurationSec > 0) {
      main = formatSetValue(`${pr.bestDurationSec}s`, "time");
    } else if (pr.kind === "km" && pr.bestDistanceKm > 0) {
      main = `${pr.bestDistanceKm} km`;
    }
    if (main) rows.push({ name, main, sub });
  }
  return rows;
}

/**
 * Personal-records list: the best-ever number per exercise across all history
 * (heaviest lift + est. 1RM, most reps, longest time, or furthest distance).
 * Renders nothing when there are no records yet.
 */
export function RecordsList({ history }: { history: CompletedWorkout[] }) {
  const records = React.useMemo(() => buildExerciseRecords(history), [history]);
  if (records.length === 0) return null;

  return (
    <ul className="divide-y overflow-hidden rounded-lg border">
      {records.map((r) => (
        <li key={r.name} className="flex items-center justify-between gap-3 p-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Trophy className="size-4 shrink-0 text-amber-500" aria-hidden />
            <div className="min-w-0">
              <div className="truncate font-medium">{r.name}</div>
              {r.sub && <div className="text-xs text-muted-foreground">{r.sub}</div>}
            </div>
          </div>
          <div className="shrink-0 font-semibold tabular-nums">{r.main}</div>
        </li>
      ))}
    </ul>
  );
}
