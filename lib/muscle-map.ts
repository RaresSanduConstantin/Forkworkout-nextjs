// Maps exercise muscle vocabulary to the MuscleMapJS body slugs and turns
// completed sets into a red heatmap: primary muscles get full weight, secondary
// muscles a pale fraction, and intensity ramps with training volume (more sets
// -> deeper red) up to a saturation point.

import type { Muscle } from "@abdofallah/musclemap-js";
import type { LibraryExercise } from "./exercises";
import type { SetStatus, SetType } from "./types";

/** Exercise-library muscle names (and legacy coarse group labels) -> SDK slugs. */
export const LIBRARY_TO_SDK: Record<string, Muscle[]> = {
  // Fine-grained library muscles.
  abdominals: ["abs"],
  abductors: ["gluteal"],
  adductors: ["quadriceps"],
  biceps: ["biceps"],
  calves: ["calves"],
  chest: ["chest"],
  forearms: ["forearm"],
  glutes: ["gluteal"],
  hamstrings: ["hamstring"],
  lats: ["upper-back"],
  "lower back": ["lower-back"],
  "middle back": ["upper-back"],
  neck: ["trapezius"],
  quadriceps: ["quadriceps"],
  shoulders: ["deltoids"],
  traps: ["trapezius"],
  triceps: ["triceps"],
  // Legacy coarse group labels (older custom exercises stored these).
  back: ["upper-back", "lower-back"],
  legs: ["quadriceps", "hamstring", "gluteal", "calves"],
  arms: ["biceps", "triceps", "forearm"],
  core: ["abs", "obliques"],
};

/** Muscles a user can assign to a custom exercise (label + stored value). */
export const SELECTABLE_MUSCLES: { value: string; label: string }[] = [
  { value: "chest", label: "Chest" },
  { value: "lats", label: "Lats" },
  { value: "middle back", label: "Upper back" },
  { value: "lower back", label: "Lower back" },
  { value: "traps", label: "Traps" },
  { value: "shoulders", label: "Shoulders" },
  { value: "biceps", label: "Biceps" },
  { value: "triceps", label: "Triceps" },
  { value: "forearms", label: "Forearms" },
  { value: "abdominals", label: "Abs" },
  { value: "quadriceps", label: "Quads" },
  { value: "hamstrings", label: "Hamstrings" },
  { value: "glutes", label: "Glutes" },
  { value: "calves", label: "Calves" },
];

const SECONDARY_WEIGHT = 0.4;
const SATURATION_SETS = 4; // primary sets to reach full red
const MIN_VISIBLE = 0.12;
export const HEAT_COLOR = "#ef4444"; // red-500

export type MuscleHighlight = { muscle: Muscle; color: string; opacity: number };

function mapMuscle(name: string): Muscle[] {
  return LIBRARY_TO_SDK[name.trim().toLowerCase()] ?? [];
}

/**
 * Accumulated per-SDK-muscle score from completed working sets. Primary muscles
 * add 1 per set; secondary muscles add a fraction. Warm-ups are excluded.
 */
export function muscleScores(
  exercises: { name: string; sets: { status?: SetStatus; type?: SetType }[] }[],
  library: LibraryExercise[]
): Record<string, number> {
  const scores: Record<string, number> = {};
  const byName = new Map(library.map((e) => [e.name.toLowerCase(), e]));

  for (const ex of exercises) {
    const done = ex.sets.filter((s) => s.status === "done" && s.type !== "warmup").length;
    if (done === 0) continue;
    const lib = byName.get(ex.name.trim().toLowerCase());
    if (!lib) continue;
    for (const m of lib.primaryMuscles ?? []) {
      for (const slug of mapMuscle(m)) scores[slug] = (scores[slug] ?? 0) + done;
    }
    for (const m of lib.secondaryMuscles ?? []) {
      for (const slug of mapMuscle(m)) scores[slug] = (scores[slug] ?? 0) + done * SECONDARY_WEIGHT;
    }
  }
  return scores;
}

/** Convert scores into red highlights whose opacity ramps with volume. */
export function muscleHighlights(scores: Record<string, number>): MuscleHighlight[] {
  const out: MuscleHighlight[] = [];
  for (const [muscle, score] of Object.entries(scores)) {
    if (score <= 0) continue;
    const opacity = Math.max(MIN_VISIBLE, Math.min(1, score / SATURATION_SETS));
    out.push({ muscle: muscle as Muscle, color: HEAT_COLOR, opacity });
  }
  return out;
}
