import { TARGET_BY_KEY, type EquipmentAccess, type MuscleTargetKey } from "@/lib/exercises";
import type { ReadinessLevel } from "@/lib/storage/daily-training-state";
import type { MusclePriorityScore } from "./muscle-priority";
import type { HistoryConfidence } from "./types";

export function historyConfidenceForCount(completedWorkoutCount: number): HistoryConfidence {
  if (completedWorkoutCount <= 0) return "none";
  if (completedWorkoutCount < 3) return "low";
  if (completedWorkoutCount < 8) return "medium";
  return "high";
}

export function buildRecommendationReasons(input: {
  targetMode: "recommended" | "manual";
  selectedPriorities: MusclePriorityScore[];
  completedWorkoutCount: number;
  readiness: ReadinessLevel;
  soreMuscles: MuscleTargetKey[];
  avoidMuscles: MuscleTargetKey[];
  equipment: EquipmentAccess;
}): { reasons: string[]; warnings: string[] } {
  const reasons: string[] = [];
  if (input.targetMode === "recommended") {
    if (input.completedWorkoutCount === 0) {
      reasons.push("There is no workout history yet, so targets are based on your setup.");
    } else {
      const supportedPriority = input.selectedPriorities.find((priority) => priority.reasons.length > 0);
      if (supportedPriority) {
        const label = TARGET_BY_KEY.get(supportedPriority.muscle)?.label ?? supportedPriority.muscle;
        reasons.push(`${label} ranked higher because ${supportedPriority.reasons[0].toLowerCase()}`);
      }
    }
  } else {
    reasons.push("Uses the muscles you selected manually.");
  }
  if (input.readiness === "tired" || input.readiness === "very-tired") {
    reasons.push(
      `Working-set volume was reduced because you selected ${input.readiness.replace("-", " ")}.`
    );
  }
  if (input.soreMuscles.length > 0) {
    reasons.push("Sore areas receive lower priority and volume.");
  }
  if (input.avoidMuscles.length > 0) {
    reasons.push("Areas marked Avoid today were excluded from direct work.");
  }
  if (input.equipment === "home") {
    reasons.push("Exercise choices fit your saved home equipment.");
  }
  const warnings =
    input.readiness === "very-tired"
      ? ["Consider choosing a short session or resting if you do not feel ready to train."]
      : [];
  return { reasons, warnings };
}
