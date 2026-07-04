"use client";

import * as React from "react";
import { RotateCcw, Trophy, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { CompletedWorkout } from "@/lib/types";
import {
  getLastPerformance,
  getExercisePR,
  suggestNextWeight,
  describeTopSet,
} from "@/lib/history-stats";

/**
 * Compact "last time / PR" line shown under an exercise in the live session.
 * Everything is derived from completed-workout history (passed in once so we
 * don't re-read localStorage per render). Renders nothing when there's no name
 * or no prior history for the exercise.
 */
export function ExerciseStatsLine({
  name,
  history,
  onApply,
}: {
  name: string;
  history: CompletedWorkout[];
  /** Apply the suggested progressive-overload weight (kg) to the exercise. */
  onApply?: (weightKg: number) => void;
}) {
  const { last, prLabel, suggest } = React.useMemo(() => {
    const clean = name.trim();
    if (!clean) return { last: null, prLabel: null, suggest: null };
    const lastStat = getLastPerformance(clean, history);
    const pr = getExercisePR(clean, history);

    let label: string | null = null;
    if (pr) {
      if (pr.kind === "kg" && pr.maxWeightKg > 0) {
        label = `${pr.maxWeightKg} kg × ${pr.maxWeightReps} · 1RM ~${Math.round(pr.bestOneRepMax)}`;
      } else if (pr.kind === "bw" && pr.bestReps > 0) {
        label = `${pr.bestReps} reps`;
      } else if (pr.kind === "time" && pr.bestDurationSec > 0) {
        label = `${pr.bestDurationSec}s`;
      } else if (pr.kind === "km" && pr.bestDistanceKm > 0) {
        label = `${pr.bestDistanceKm} km`;
      }
    }

    return {
      last: lastStat,
      prLabel: label,
      suggest: suggestNextWeight(clean, history),
    };
  }, [name, history]);

  if (!last) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <RotateCcw className="size-3.5" aria-hidden />
        Last: <span className="font-medium text-foreground">{describeTopSet(last)}</span>
      </span>
      {prLabel && (
        <span className="inline-flex items-center gap-1">
          <Trophy className="size-3.5 text-amber-500" aria-hidden />
          PR: <span className="font-medium text-foreground">{prLabel}</span>
        </span>
      )}
      {suggest != null &&
        (onApply ? (
          <button
            type="button"
            onClick={() => onApply(suggest)}
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Apply suggested weight ${suggest} kg to this exercise`}
          >
            <Badge
              variant="secondary"
              className="cursor-pointer gap-1 font-medium transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              <TrendingUp className="size-3" aria-hidden />
              Try {suggest} kg
            </Badge>
          </button>
        ) : (
          <Badge variant="secondary" className="gap-1 font-medium">
            <TrendingUp className="size-3" aria-hidden />
            Try {suggest} kg
          </Badge>
        ))}
    </div>
  );
}
