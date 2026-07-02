import type { CompletedWorkout, Workout } from "@/lib/types";
import { getWorkouts, saveWorkouts } from "./workout-storage";
import { getCompletedWorkouts } from "./history-storage";
import { STORAGE_KEYS } from "./keys";
import { writeJson } from "./safe-storage";

export type ExportBundle = {
  version: number;
  exportedAt: string;
  workouts: Workout[];
  completedWorkouts: CompletedWorkout[];
};

/** Builds a full snapshot of the user's local data. */
export function buildExport(): ExportBundle {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    workouts: getWorkouts(),
    completedWorkouts: getCompletedWorkouts(),
  };
}

/** Triggers a browser download of the export bundle as a JSON file. */
export function downloadExport(): void {
  if (typeof window === "undefined") return;
  const bundle = buildExport();
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `forkworkout-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Merges an exported bundle into local data: adds workouts with new ids and
 * completed entries with new timestamps, skipping exact duplicates. Throws on
 * invalid JSON. Returns how many items were added.
 */
export function mergeImport(text: string): { workoutsAdded: number; historyAdded: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  const bundle = (parsed ?? {}) as Partial<ExportBundle>;
  const importedWorkouts = Array.isArray(bundle.workouts) ? bundle.workouts : [];
  const importedHistory = Array.isArray(bundle.completedWorkouts)
    ? bundle.completedWorkouts
    : [];

  // Merge workouts by id.
  const workouts = getWorkouts();
  const workoutIds = new Set(workouts.map((w) => w.id));
  let workoutsAdded = 0;
  for (const w of importedWorkouts) {
    if (w && typeof w.id === "string" && !workoutIds.has(w.id)) {
      workouts.push(w);
      workoutIds.add(w.id);
      workoutsAdded += 1;
    }
  }
  saveWorkouts(workouts);

  // Merge history by ISO date (unique per completion).
  const history = getCompletedWorkouts();
  const historyDates = new Set(history.map((c) => c.date));
  let historyAdded = 0;
  for (const c of importedHistory) {
    if (c && typeof c.date === "string" && !historyDates.has(c.date)) {
      history.push(c);
      historyDates.add(c.date);
      historyAdded += 1;
    }
  }
  writeJson(STORAGE_KEYS.completedWorkouts, history);

  return { workoutsAdded, historyAdded };
}
