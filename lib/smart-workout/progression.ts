import type { CompletedWorkout } from "@/lib/types";
import {
  getExerciseStableId,
  type LibraryExercise,
} from "@/lib/exercises";
import { getLastPerformance, suggestNextWeight } from "@/lib/history-stats";
import {
  getLatestExerciseFeedback,
  type ExercisePerformanceFeedback,
} from "@/lib/storage/performance-feedback";

export type ProgressionDecision = {
  weightKg: number | null;
  source: "feedback" | "history" | "none";
  reason: string;
};

/** Smallest practical load change for common equipment in this library. */
export function equipmentWeightIncrementKg(exercise: LibraryExercise): number {
  const equipment = (exercise.equipment ?? "").toLowerCase();
  if (equipment.includes("kettlebell")) return 4;
  if (equipment.includes("machine") || equipment.includes("cable")) return 5;
  if (equipment.includes("dumbbell")) return 2;
  return 2.5;
}

function finitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function roundToIncrement(value: number, increment: number): number {
  if (!finitePositive(value) || !finitePositive(increment)) return 0;
  return Math.round((value / increment) * increment * 100) / 100;
}

/**
 * Conservative feedback-aware progression. Missing feedback delegates to the
 * existing `suggestNextWeight` algorithm unchanged for backwards compatibility.
 */
export function getProgressionDecision(
  exercise: LibraryExercise,
  feedback: ExercisePerformanceFeedback[],
  history?: CompletedWorkout[]
): ProgressionDecision {
  const exerciseId = getExerciseStableId(exercise);
  const latest = getLatestExerciseFeedback(exerciseId, feedback);
  if (!latest) {
    const legacy = suggestNextWeight(exercise.name, history);
    return finitePositive(legacy)
      ? {
          weightKg: legacy,
          source: "history",
          reason: "Based on your latest completed workout.",
        }
      : { weightKg: null, source: "none", reason: "No weighted history yet." };
  }

  const last = getLastPerformance(exercise.name, history);
  const current = finitePositive(latest.topWeightKg)
    ? latest.topWeightKg
    : finitePositive(last?.topWeightKg)
      ? last.topWeightKg
      : null;
  if (!current) {
    return { weightKg: null, source: "feedback", reason: "No kilogram load to adjust." };
  }

  const increment = equipmentWeightIncrementKg(exercise);
  const allSetsCompleted =
    latest.plannedWorkingSets > 0 &&
    latest.completedWorkingSets >= latest.plannedWorkingSets;
  let next = current;
  let reason = "Keep the last load.";

  switch (latest.difficulty) {
    case "easy":
      if (allSetsCompleted) {
        next = current + increment;
        reason = `All working sets felt easy; add ${increment} kg.`;
      }
      break;
    case "good":
      reason = "The load felt good; keep it for another session.";
      break;
    case "hard":
      reason = "The last load felt hard; keep it steady.";
      break;
    case "failed": {
      const completion =
        latest.plannedWorkingSets > 0
          ? latest.completedWorkingSets / latest.plannedWorkingSets
          : 0;
      if (completion < 0.75) {
        next = Math.max(increment, current - increment);
        reason = `Several sets were missed; reduce by ${increment} kg.`;
      } else {
        reason = "A set was missed; keep the load steady.";
      }
      break;
    }
    case "painful":
      reason = "Painful feedback blocks any load increase.";
      break;
  }

  const weightKg = roundToIncrement(next, increment);
  return finitePositive(weightKg)
    ? { weightKg, source: "feedback", reason }
    : { weightKg: null, source: "feedback", reason: "No valid load suggestion." };
}

export function suggestNextWeightWithFeedback(
  exercise: LibraryExercise,
  feedback: ExercisePerformanceFeedback[],
  history?: CompletedWorkout[]
): number | null {
  return getProgressionDecision(exercise, feedback, history).weightKg;
}
