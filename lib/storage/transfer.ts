import type { BodyMetricEntry, CompletedWorkout, Workout, WorkoutProgram } from "@/lib/types";
import { getWorkouts, saveWorkouts } from "./workout-storage";
import { getCompletedWorkouts } from "./history-storage";
import { getBodyMetrics } from "./body-storage";
import { getBodyProfile, updateBodyProfile, type BodyProfile } from "./profile";
import { getSettings, saveSettings, type AppSettings } from "./settings";
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
import {
  getExercisePreferences,
  saveExercisePreferences,
  type ExercisePreference,
} from "./exercise-preferences";
import {
  getPerformanceFeedback,
  savePerformanceFeedback,
  type ExercisePerformanceFeedback,
} from "./performance-feedback";
import {
  getDailyTrainingStates,
  saveDailyTrainingState,
  type DailyTrainingState,
} from "./daily-training-state";
import { getProgramState, saveProgramState } from "./program-storage";
import type { ProgramProgress } from "./program-storage";

export type ExportBundle = {
  version: number;
  exportedAt: string;
  workouts: Workout[];
  programs?: WorkoutProgram[];
  activeProgramId?: string;
  programProgress?: Record<string, ProgramProgress>;
  completedWorkouts: CompletedWorkout[];
  bodyMetrics: BodyMetricEntry[];
  customExercises: CustomExercise[];
  exercisePreferences?: ExercisePreference[];
  performanceFeedback?: ExercisePerformanceFeedback[];
  dailyTrainingStates?: DailyTrainingState[];
  bodyProfile?: BodyProfile;
  settings?: AppSettings;
  homeEquipment?: HomeEquipment;
};

/** Builds a full snapshot of the user's local data. */
export function buildExport(): ExportBundle {
  const programState = getProgramState();
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    workouts: getWorkouts(),
    programs: programState.programs,
    activeProgramId: programState.activeProgramId,
    programProgress: programState.progressByProgramId,
    completedWorkouts: getCompletedWorkouts(),
    bodyMetrics: getBodyMetrics(),
    customExercises: getCustomExercises(),
    exercisePreferences: getExercisePreferences(),
    performanceFeedback: getPerformanceFeedback(),
    dailyTrainingStates: getDailyTrainingStates(),
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
export function mergeImport(
  text: string,
  options: { restoreSettings?: boolean; restoreBodyData?: boolean } = {}
): {
  workoutsAdded: number;
  historyAdded: number;
  bodyAdded: number;
  bodyUpdated: number;
  exercisesAdded: number;
  programsAdded: number;
  profileRestored: boolean;
  settingsRestored: boolean;
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
  const importedPrograms = Array.isArray(bundle.programs) ? bundle.programs : [];
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

  const programState = getProgramState();
  const programIds = new Set(programState.programs.map((program) => program.id));
  const programs = [...programState.programs];
  const addedProgramIds = new Set<string>();
  let programsAdded = 0;
  for (const program of importedPrograms) {
    if (program && typeof program.id === "string" && !programIds.has(program.id)) {
      programs.push(program);
      programIds.add(program.id);
      addedProgramIds.add(program.id);
      programsAdded += 1;
    }
  }
  const progressByProgramId = { ...programState.progressByProgramId };
  if (bundle.programProgress && typeof bundle.programProgress === "object") {
    for (const programId of addedProgramIds) {
      const progress = bundle.programProgress[programId];
      if (progress) progressByProgramId[programId] = progress;
    }
  }
  saveProgramState({
    version: 1,
    programs,
    progressByProgramId,
    activeProgramId:
      programState.activeProgramId ??
      (typeof bundle.activeProgramId === "string" ? bundle.activeProgramId : undefined),
  });

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

  // Merge body metrics by id. Explicit backup recovery lets the snapshot win
  // for matching ids so edits to an existing measurement are restored too.
  const body = getBodyMetrics();
  const bodyIndexes = new Map(body.map((entry, index) => [entry.id, index]));
  let bodyAdded = 0;
  let bodyUpdated = 0;
  for (const b of importedBody) {
    if (!b || typeof b.id !== "string") continue;
    const existingIndex = bodyIndexes.get(b.id);
    if (existingIndex === undefined) {
      body.push(b);
      bodyIndexes.set(b.id, body.length - 1);
      bodyAdded += 1;
    } else if (
      options.restoreBodyData &&
      JSON.stringify(body[existingIndex]) !== JSON.stringify(b)
    ) {
      body[existingIndex] = b;
      bodyUpdated += 1;
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

  // Keep the newest preference per stable exercise id.
  const importedPreferences = Array.isArray(bundle.exercisePreferences)
    ? bundle.exercisePreferences
    : [];
  const preferences = new Map(
    getExercisePreferences().map((preference) => [preference.exerciseId, preference])
  );
  for (const preference of importedPreferences) {
    if (!preference || typeof preference.exerciseId !== "string") continue;
    const existing = preferences.get(preference.exerciseId);
    if (
      !existing ||
      Date.parse(preference.updatedAt ?? "") > Date.parse(existing.updatedAt ?? "")
    ) {
      preferences.set(preference.exerciseId, preference);
    }
  }
  saveExercisePreferences(Array.from(preferences.values()));

  // Performance feedback is event data. The storage writer validates,
  // de-duplicates, sorts, and applies its bounded-history limit.
  const importedFeedback = Array.isArray(bundle.performanceFeedback)
    ? bundle.performanceFeedback
    : [];
  savePerformanceFeedback([...getPerformanceFeedback(), ...importedFeedback]);

  if (Array.isArray(bundle.dailyTrainingStates)) {
    for (const dailyState of bundle.dailyTrainingStates) saveDailyTrainingState(dailyState);
  }

  // Restore body profile: only fill fields that aren't already set locally, so
  // an import never clobbers the current device's profile.
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

  // Regular cross-device merging keeps this device's preferences. A JSON or
  // cloud backup recovery opts in because settings (including onboarding,
  // weekly goal, sound, and vibration) are part of a complete backup.
  let settingsRestored = false;
  if (options.restoreSettings && bundle.settings && typeof bundle.settings === "object") {
    saveSettings(bundle.settings);
    settingsRestored = true;
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
    bodyUpdated,
    exercisesAdded,
    programsAdded,
    profileRestored,
    settingsRestored,
    homeEquipmentRestored,
  };
}
