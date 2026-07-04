import type { BodyMetricEntry, CompletedWorkout, Workout } from "@/lib/types";
import { getWorkouts, saveWorkouts } from "./workout-storage";
import { getCompletedWorkouts } from "./history-storage";
import { getBodyMetrics } from "./body-storage";
import { getBodyProfile, updateBodyProfile, type BodyProfile } from "./profile";
import { getSettings, type AppSettings } from "./settings";
import {
  getHomeEquipment,
  saveHomeEquipment,
  type HomeEquipment,
} from "./home-equipment";
import {
  getCustomExercises,
  saveCustomExercises,
  type CustomExercise,
} from "./custom-exercises";
import { STORAGE_KEYS } from "./keys";
import { writeJson } from "./safe-storage";

export type ExportBundle = {
  version: number;
  exportedAt: string;
  workouts: Workout[];
  completedWorkouts: CompletedWorkout[];
  bodyMetrics: BodyMetricEntry[];
  customExercises: CustomExercise[];
  bodyProfile?: BodyProfile;
  settings?: AppSettings;
  homeEquipment?: HomeEquipment;
};

/** Builds a full snapshot of the user's local data. */
export function buildExport(): ExportBundle {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    workouts: getWorkouts(),
    completedWorkouts: getCompletedWorkouts(),
    bodyMetrics: getBodyMetrics(),
    customExercises: getCustomExercises(),
    bodyProfile: getBodyProfile(),
    settings: getSettings(),
    homeEquipment: getHomeEquipment(),
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
export function mergeImport(text: string): {
  workoutsAdded: number;
  historyAdded: number;
  bodyAdded: number;
  exercisesAdded: number;
  profileRestored: boolean;
  homeEquipmentRestored: boolean;
} {
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
  const importedBody = Array.isArray(bundle.bodyMetrics) ? bundle.bodyMetrics : [];
  const importedExercises = Array.isArray(bundle.customExercises) ? bundle.customExercises : [];

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

  // Merge body metrics by id.
  const body = getBodyMetrics();
  const bodyIds = new Set(body.map((b) => b.id));
  let bodyAdded = 0;
  for (const b of importedBody) {
    if (b && typeof b.id === "string" && !bodyIds.has(b.id)) {
      body.push(b);
      bodyIds.add(b.id);
      bodyAdded += 1;
    }
  }
  writeJson(STORAGE_KEYS.bodyMetrics, body);

  // Merge custom exercises by normalized name.
  const exercises = getCustomExercises();
  const exNames = new Set(exercises.map((e) => e.name.toLowerCase()));
  let exercisesAdded = 0;
  for (const e of importedExercises) {
    if (e && typeof e.name === "string" && !exNames.has(e.name.toLowerCase())) {
      exercises.push(e);
      exNames.add(e.name.toLowerCase());
      exercisesAdded += 1;
    }
  }
  saveCustomExercises(exercises);

  // Restore body profile: only fill fields that aren't already set locally, so
  // an import never clobbers the current device's profile. (Settings are
  // device-local preferences, so they're left untouched on merge-import.)
  let profileRestored = false;
  const bp = bundle.bodyProfile;
  if (bp && typeof bp === "object") {
    const current = getBodyProfile();
    const patch: Partial<BodyProfile> = {};
    (["heightCm", "sex", "birthYear", "activity", "goalWeightKg"] as const).forEach((k) => {
      if (current[k] === undefined && bp[k] !== undefined) {
        (patch as Record<string, unknown>)[k] = bp[k];
      }
    });
    if (Object.keys(patch).length > 0) {
      updateBodyProfile(patch);
      profileRestored = true;
    }
  }

  // Restore home equipment only when this device has none set yet, so an import
  // never overwrites gear the user already configured here.
  let homeEquipmentRestored = false;
  const he = bundle.homeEquipment;
  if (he && typeof he === "object") {
    const current = getHomeEquipment();
    const localEmpty =
      current.owned.length === 0 &&
      current.dumbbellMaxKg === undefined &&
      current.kettlebellMaxKg === undefined;
    if (localEmpty) {
      saveHomeEquipment(he);
      homeEquipmentRestored = true;
    }
  }

  return {
    workoutsAdded,
    historyAdded,
    bodyAdded,
    exercisesAdded,
    profileRestored,
    homeEquipmentRestored,
  };
}
