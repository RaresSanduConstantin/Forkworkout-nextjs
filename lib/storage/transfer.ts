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
import type {
  NutritionDayAdjustment,
  NutritionEntry,
  NutritionFood,
  NutritionFoodPreference,
  NutritionSavedMeal,
  NutritionTargetHistoryEntry,
  NutritionTargets,
} from "@/lib/nutrition/types";
import { isValidGtin } from "@/lib/nutrition/barcodes";
import {
  getNutritionDayAdjustments,
  getNutritionEntries,
  getNutritionTargets,
  getNutritionTargetHistory,
  normalizeNutritionDayAdjustment,
  normalizeNutritionEntry,
  saveNutritionDayAdjustments,
  saveNutritionEntries,
  saveNutritionTargets,
  saveNutritionTargetHistory,
} from "./nutrition-storage";
import {
  getCustomNutritionFoods,
  getNutritionFoodPreferences,
  normalizeNutritionFood,
  normalizeNutritionFoodPreference,
  saveCustomNutritionFoods,
  saveNutritionFoodPreferences,
} from "./nutrition-food-storage";
import {
  getNutritionSavedMeals,
  normalizeNutritionSavedMeal,
  saveNutritionSavedMeals,
} from "./nutrition-meal-storage";
import {
  getCachedNutritionBarcodeProducts,
  saveCachedNutritionBarcodeProducts,
} from "./nutrition-barcode-storage";
import {
  getCachedNutritionUsdaFoods,
  saveCachedNutritionUsdaFoods,
} from "./nutrition-usda-storage";

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
  nutritionEntries?: NutritionEntry[];
  nutritionTargets?: NutritionTargets;
  nutritionTargetHistory?: NutritionTargetHistoryEntry[];
  nutritionDayAdjustments?: NutritionDayAdjustment[];
  customNutritionFoods?: NutritionFood[];
  nutritionFoodPreferences?: NutritionFoodPreference[];
  nutritionSavedMeals?: NutritionSavedMeal[];
  nutritionBarcodeProducts?: NutritionFood[];
  nutritionUsdaFoods?: NutritionFood[];
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
    nutritionEntries: getNutritionEntries(),
    nutritionTargets: getNutritionTargets() ?? undefined,
    nutritionTargetHistory: getNutritionTargetHistory(),
    nutritionDayAdjustments: getNutritionDayAdjustments(),
    customNutritionFoods: getCustomNutritionFoods(),
    nutritionFoodPreferences: getNutritionFoodPreferences(),
    nutritionSavedMeals: getNutritionSavedMeals(),
    nutritionBarcodeProducts: getCachedNutritionBarcodeProducts(),
    nutritionUsdaFoods: getCachedNutritionUsdaFoods(),
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
  options: {
    restoreSettings?: boolean;
    restoreBodyData?: boolean;
    restoreNutritionData?: boolean;
  } = {}
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
  nutritionEntriesAdded: number;
  nutritionEntriesUpdated: number;
  nutritionTargetsRestored: boolean;
  nutritionDayAdjustmentsRestored: number;
  customNutritionFoodsAdded: number;
  nutritionFoodPreferencesRestored: number;
  nutritionSavedMealsAdded: number;
  nutritionBarcodeProductsRestored: number;
  nutritionUsdaFoodsRestored: number;
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

  const nutritionEntries = getNutritionEntries();
  const nutritionEntryIndexes = new Map(
    nutritionEntries.map((entry, index) => [entry.id, index])
  );
  let nutritionEntriesAdded = 0;
  let nutritionEntriesUpdated = 0;
  if (Array.isArray(bundle.nutritionEntries)) {
    for (const rawEntry of bundle.nutritionEntries) {
      const entry = normalizeNutritionEntry(rawEntry);
      if (!entry) continue;
      const existingIndex = nutritionEntryIndexes.get(entry.id);
      if (existingIndex === undefined) {
        nutritionEntries.push(entry);
        nutritionEntryIndexes.set(entry.id, nutritionEntries.length - 1);
        nutritionEntriesAdded += 1;
      } else if (
        options.restoreNutritionData &&
        JSON.stringify(nutritionEntries[existingIndex]) !== JSON.stringify(entry)
      ) {
        nutritionEntries[existingIndex] = entry;
        nutritionEntriesUpdated += 1;
      }
    }
    saveNutritionEntries(nutritionEntries);
  }

  let nutritionDayAdjustmentsRestored = 0;
  if (Array.isArray(bundle.nutritionDayAdjustments)) {
    const adjustmentsByDay = new Map(
      getNutritionDayAdjustments().map((adjustment) => [adjustment.dayKey, adjustment])
    );
    for (const rawAdjustment of bundle.nutritionDayAdjustments) {
      const adjustment = normalizeNutritionDayAdjustment(rawAdjustment);
      if (!adjustment) continue;
      const existing = adjustmentsByDay.get(adjustment.dayKey);
      if (
        !existing ||
        (options.restoreNutritionData &&
          JSON.stringify(existing) !== JSON.stringify(adjustment))
      ) {
        adjustmentsByDay.set(adjustment.dayKey, adjustment);
        nutritionDayAdjustmentsRestored += 1;
      }
    }
    saveNutritionDayAdjustments(Array.from(adjustmentsByDay.values()));
  }

  const customNutritionFoods = getCustomNutritionFoods();
  const customFoodIndexes = new Map(
    customNutritionFoods.map((food, index) => [food.id, index])
  );
  let customNutritionFoodsAdded = 0;
  if (Array.isArray(bundle.customNutritionFoods)) {
    for (const rawFood of bundle.customNutritionFoods) {
      const food = normalizeNutritionFood(rawFood, "custom");
      if (!food) continue;
      const existingIndex = customFoodIndexes.get(food.id);
      if (existingIndex === undefined) {
        customNutritionFoods.push(food);
        customFoodIndexes.set(food.id, customNutritionFoods.length - 1);
        customNutritionFoodsAdded += 1;
      } else if (options.restoreNutritionData) {
        customNutritionFoods[existingIndex] = food;
      }
    }
    saveCustomNutritionFoods(customNutritionFoods);
  }

  const foodPreferences = new Map(
    getNutritionFoodPreferences().map((preference) => [preference.foodKey, preference])
  );
  let nutritionFoodPreferencesRestored = 0;
  if (Array.isArray(bundle.nutritionFoodPreferences)) {
    for (const rawPreference of bundle.nutritionFoodPreferences) {
      const preference = normalizeNutritionFoodPreference(rawPreference);
      if (!preference) continue;
      const existing = foodPreferences.get(preference.foodKey);
      if (
        !existing ||
        options.restoreNutritionData ||
        preference.updatedAt > existing.updatedAt
      ) {
        foodPreferences.set(preference.foodKey, preference);
        nutritionFoodPreferencesRestored += 1;
      }
    }
    saveNutritionFoodPreferences(Array.from(foodPreferences.values()));
  }

  const savedMeals = getNutritionSavedMeals();
  const savedMealIndexes = new Map(savedMeals.map((meal, index) => [meal.id, index]));
  let nutritionSavedMealsAdded = 0;
  if (Array.isArray(bundle.nutritionSavedMeals)) {
    for (const rawMeal of bundle.nutritionSavedMeals) {
      const meal = normalizeNutritionSavedMeal(rawMeal);
      if (!meal) continue;
      const existingIndex = savedMealIndexes.get(meal.id);
      if (existingIndex === undefined) {
        savedMeals.push(meal);
        savedMealIndexes.set(meal.id, savedMeals.length - 1);
        nutritionSavedMealsAdded += 1;
      } else if (options.restoreNutritionData) {
        savedMeals[existingIndex] = meal;
      }
    }
    saveNutritionSavedMeals(savedMeals);
  }

  const barcodeProducts = new Map(
    getCachedNutritionBarcodeProducts().map((product) => [product.id, product])
  );
  let nutritionBarcodeProductsRestored = 0;
  if (Array.isArray(bundle.nutritionBarcodeProducts)) {
    for (const rawProduct of bundle.nutritionBarcodeProducts) {
      const product = normalizeNutritionFood(rawProduct, "barcode");
      if (!product || !isValidGtin(product.id)) continue;
      const existing = barcodeProducts.get(product.id);
      if (
        !existing ||
        options.restoreNutritionData ||
        (product.updatedAt ?? "") > (existing.updatedAt ?? "")
      ) {
        barcodeProducts.set(product.id, product);
        nutritionBarcodeProductsRestored += 1;
      }
    }
    saveCachedNutritionBarcodeProducts(Array.from(barcodeProducts.values()));
  }

  const usdaFoods = new Map(
    getCachedNutritionUsdaFoods().map((food) => [food.id, food])
  );
  let nutritionUsdaFoodsRestored = 0;
  if (Array.isArray(bundle.nutritionUsdaFoods)) {
    for (const rawFood of bundle.nutritionUsdaFoods) {
      const food = normalizeNutritionFood(rawFood, "usda");
      if (!food) continue;
      const existing = usdaFoods.get(food.id);
      if (
        !existing ||
        options.restoreNutritionData ||
        (food.updatedAt ?? "") > (existing.updatedAt ?? "")
      ) {
        usdaFoods.set(food.id, food);
        nutritionUsdaFoodsRestored += 1;
      }
    }
    saveCachedNutritionUsdaFoods(Array.from(usdaFoods.values()));
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

  let nutritionTargetsRestored = false;
  if (
    bundle.nutritionTargets &&
    typeof bundle.nutritionTargets === "object" &&
    (options.restoreSettings || getNutritionTargets() === null)
  ) {
    nutritionTargetsRestored =
      saveNutritionTargets(
        bundle.nutritionTargets,
        Array.isArray(bundle.nutritionTargetHistory) &&
          bundle.nutritionTargetHistory.length > 0
          ? undefined
          : { effectiveFrom: "1970-01-01" }
      ) !== null;
  }
  if (
    nutritionTargetsRestored &&
    Array.isArray(bundle.nutritionTargetHistory) &&
    bundle.nutritionTargetHistory.length > 0
  ) {
    saveNutritionTargetHistory(bundle.nutritionTargetHistory);
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
    nutritionEntriesAdded,
    nutritionEntriesUpdated,
    nutritionTargetsRestored,
    nutritionDayAdjustmentsRestored,
    customNutritionFoodsAdded,
    nutritionFoodPreferencesRestored,
    nutritionSavedMealsAdded,
    nutritionBarcodeProductsRestored,
    nutritionUsdaFoodsRestored,
  };
}
