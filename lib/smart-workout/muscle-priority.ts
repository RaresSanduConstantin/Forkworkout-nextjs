import type {
  Experience,
  Goal,
  MuscleTargetKey,
} from "@/lib/exercises";
import { TARGET_BY_KEY } from "@/lib/exercises";
import type { MuscleTrainingStatus } from "./history-summary";
import { MUSCLE_PRIORITY_CONFIG as CONFIG } from "./config";

export type MusclePriorityScore = {
  muscle: MuscleTargetKey;
  score: number;
  reasons: string[];
  blocked: boolean;
};

export type MusclePriorityContext = {
  experience: Experience;
  goal: Goal;
  soreMuscles?: MuscleTargetKey[];
  avoidMuscles?: MuscleTargetKey[];
  manuallySelectedMuscles?: MuscleTargetKey[];
};

/** Deterministic planning priority. It intentionally makes no biological recovery claim. */
export function scoreMusclePriorities(
  statuses: MuscleTrainingStatus[],
  context: MusclePriorityContext
): MusclePriorityScore[] {
  const sore = new Set(context.soreMuscles ?? []);
  const avoided = new Set(context.avoidMuscles ?? []);
  const manual = new Set(context.manuallySelectedMuscles ?? []);
  const targetVolume = CONFIG.targetSetsLast7Days[context.experience];

  return statuses.map((status) => {
    if (avoided.has(status.muscle)) {
      return {
        muscle: status.muscle,
        score: Number.NEGATIVE_INFINITY,
        reasons: ["Avoided today."],
        blocked: true,
      };
    }

    let score = CONFIG.baseScore;
    const reasons: string[] = [];
    const missingSets = Math.max(0, targetVolume - status.completedSetsLast7Days);
    if (missingSets > 0) {
      score += missingSets * CONFIG.pointsPerMissingSet;
      reasons.push("Lower recent training volume.");
    }

    if (status.hoursSinceLastTrained === undefined) {
      score += CONFIG.neverTrainedBonus;
      reasons.push("No recent local training history.");
    } else if (status.hoursSinceLastTrained >= 96) {
      score += CONFIG.hours96Bonus;
      reasons.push("Not trained in the last four days.");
    } else if (status.hoursSinceLastTrained >= 48) {
      score += CONFIG.hours48Bonus;
      reasons.push("Not trained in the last two days.");
    } else if (status.hoursSinceLastTrained < 24) {
      score -= CONFIG.trainedWithin24Penalty;
      reasons.push("Trained within the last day.");
    }

    if (status.recentWorkoutCount > CONFIG.frequentWorkoutThreshold) {
      score -=
        (status.recentWorkoutCount - CONFIG.frequentWorkoutThreshold) *
        CONFIG.pointsPerExtraRecentWorkout;
      reasons.push("Appeared in several recent workouts.");
    }
    if (sore.has(status.muscle)) {
      score -= CONFIG.sorenessPenalty;
      reasons.push("Marked sore today.");
    }
    if (manual.has(status.muscle)) {
      score += CONFIG.manualTargetBonus;
      reasons.push("Selected as a target.");
    }

    return { muscle: status.muscle, score, reasons, blocked: false };
  });
}

/** Selects high-priority muscles while avoiding a same-region recommendation. */
export function selectRecommendedMuscles(
  scores: MusclePriorityScore[],
  count: number
): MusclePriorityScore[] {
  const groupOrder = ["Legs", "Back", "Chest", "Shoulders", "Arms", "Core"];
  const sorted = scores
    .filter((score) => !score.blocked && Number.isFinite(score.score))
    .sort(
      (a, b) =>
        b.score - a.score ||
        groupOrder.indexOf(TARGET_BY_KEY.get(a.muscle)?.group ?? "Core") -
          groupOrder.indexOf(TARGET_BY_KEY.get(b.muscle)?.group ?? "Core") ||
        a.muscle.localeCompare(b.muscle)
    );
  const selected: MusclePriorityScore[] = [];
  const usedGroups = new Set<string>();
  for (const score of sorted) {
    const group = TARGET_BY_KEY.get(score.muscle)?.group ?? score.muscle;
    if (usedGroups.has(group)) continue;
    selected.push(score);
    usedGroups.add(group);
    if (selected.length >= count) return selected;
  }
  for (const score of sorted) {
    if (selected.includes(score)) continue;
    selected.push(score);
    if (selected.length >= count) break;
  }
  return selected;
}
