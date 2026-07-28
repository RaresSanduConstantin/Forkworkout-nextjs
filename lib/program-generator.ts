import type { MuscleTargetKey } from "@/lib/exercises";

export type ProgramDayPlan = {
  title: string;
  targetMuscles: MuscleTargetKey[];
};

const PUSH: MuscleTargetKey[] = ["chest", "shoulders", "triceps"];
const PULL: MuscleTargetKey[] = ["lats", "lowerback", "traps", "biceps", "forearms"];
const LEGS: MuscleTargetKey[] = ["quads", "hamstrings", "glutes", "calves"];
const CORE: MuscleTargetKey[] = ["abs", "obliques"];
const UPPER = [...PUSH, ...PULL];

const TEMPLATES: Record<number, { title: string; muscles: MuscleTargetKey[] }[]> = {
  2: [
    { title: "Upper Body", muscles: UPPER },
    { title: "Lower Body & Core", muscles: [...LEGS, ...CORE] },
  ],
  3: [
    { title: "Push", muscles: PUSH },
    { title: "Pull", muscles: PULL },
    { title: "Legs & Core", muscles: [...LEGS, ...CORE] },
  ],
  4: [
    { title: "Upper Push", muscles: PUSH },
    { title: "Lower Quads & Core", muscles: ["quads", "calves", ...CORE] },
    { title: "Upper Pull", muscles: PULL },
    { title: "Lower Posterior", muscles: ["hamstrings", "glutes", "calves"] },
  ],
  5: [
    { title: "Push", muscles: PUSH },
    { title: "Pull", muscles: PULL },
    { title: "Legs", muscles: LEGS },
    { title: "Upper Body", muscles: UPPER },
    { title: "Lower Body & Core", muscles: [...LEGS, ...CORE] },
  ],
  6: [
    { title: "Push A", muscles: PUSH },
    { title: "Pull A", muscles: PULL },
    { title: "Legs A", muscles: [...LEGS, ...CORE] },
    { title: "Push B", muscles: PUSH },
    { title: "Pull B", muscles: PULL },
    { title: "Legs B", muscles: [...LEGS, ...CORE] },
  ],
};

/** Applies a familiar split while respecting the user's overall muscle scope. */
export function planProgramDays(
  selectedMuscles: MuscleTargetKey[],
  days: number
): ProgramDayPlan[] {
  const safeDays = Math.min(6, Math.max(2, Math.round(days)));
  const selected = [...new Set(selectedMuscles)];
  if (selected.length === 0) return [];
  const selectedSet = new Set(selected);
  return TEMPLATES[safeDays].map((template, index) => {
    const matching = template.muscles.filter((muscle) => selectedSet.has(muscle));
    return {
      title: template.title,
      // A narrow target selection can leave a standard split day empty. Keep
      // the requested number of days useful by rotating the selected targets.
      targetMuscles: matching.length > 0 ? matching : [selected[index % selected.length]],
    };
  });
}
