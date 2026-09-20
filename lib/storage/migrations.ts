// Versioned local-storage migrations with a temporary safety snapshot.
//
// The app's persisted shapes are read through back-compat normalizers, so no
// destructive migration is needed today — the value here is the framework plus a
// safety snapshot taken the first time a user upgrades to a new schema version.
// Future breaking changes append a migration to MIGRATIONS.

import { STORAGE_KEYS } from "./keys";
import { readJson, removeJson, writeJson } from "./safe-storage";
import { saveWorkouts } from "./workout-storage";
import { buildExport, type ExportBundle } from "./transfer";
import { saveProgramState } from "./program-storage";

export const CURRENT_SCHEMA_VERSION = 1;
export const MIGRATION_BACKUP_RETENTION_DAYS = 30;
const MIGRATION_BACKUP_RETENTION_MS =
  MIGRATION_BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;

// MIGRATIONS[v] upgrades storage from version v to v+1. Empty for now.
const MIGRATIONS: (() => void)[] = [];

export type MigrationSafetyBackup = {
  fromVersion: number;
  savedAt: string;
  bundle: ExportBundle;
};

export function getSchemaVersion(): number {
  const v = readJson<number>(STORAGE_KEYS.schemaVersion, 0);
  return typeof v === "number" && v >= 0 ? v : 0;
}

export function getMigrationSafetyBackup(now = Date.now()): MigrationSafetyBackup | null {
  const b = readJson<MigrationSafetyBackup | null>(STORAGE_KEYS.autoBackup, null);
  if (!b || typeof b !== "object" || !b.bundle || typeof b.bundle !== "object") return null;
  const savedAt = Date.parse(b.savedAt);
  if (!Number.isFinite(savedAt)) return null;
  if (now - savedAt > MIGRATION_BACKUP_RETENTION_MS) {
    removeJson(STORAGE_KEYS.autoBackup);
    return null;
  }
  return b;
}

/** Whether the backup actually contains any user data worth restoring. */
export function migrationSafetyBackupHasData(b: MigrationSafetyBackup | null): boolean {
  if (!b) return false;
  const { workouts, completedWorkouts, bodyMetrics } = b.bundle;
  return (
    (Array.isArray(workouts) && workouts.length > 0) ||
    (Array.isArray(b.bundle.programs) && b.bundle.programs.length > 0) ||
    (Array.isArray(completedWorkouts) && completedWorkouts.length > 0) ||
    (Array.isArray(bodyMetrics) && bodyMetrics.length > 0) ||
    (Array.isArray(b.bundle.customExercises) && b.bundle.customExercises.length > 0) ||
    (Array.isArray(b.bundle.exercisePreferences) && b.bundle.exercisePreferences.length > 0) ||
    (Array.isArray(b.bundle.performanceFeedback) && b.bundle.performanceFeedback.length > 0) ||
    (Array.isArray(b.bundle.dailyTrainingStates) && b.bundle.dailyTrainingStates.length > 0) ||
    (Array.isArray(b.bundle.nutritionEntries) && b.bundle.nutritionEntries.length > 0) ||
    (Array.isArray(b.bundle.nutritionDayAdjustments) &&
      b.bundle.nutritionDayAdjustments.length > 0) ||
    (Array.isArray(b.bundle.customNutritionFoods) &&
      b.bundle.customNutritionFoods.length > 0) ||
    (Array.isArray(b.bundle.nutritionFoodPreferences) &&
      b.bundle.nutritionFoodPreferences.length > 0) ||
    (Array.isArray(b.bundle.nutritionSavedMeals) &&
      b.bundle.nutritionSavedMeals.length > 0) ||
    Boolean(b.bundle.nutritionTargets) ||
    Boolean(b.bundle.bodyProfile) ||
    Boolean(b.bundle.settings) ||
    Boolean(b.bundle.homeEquipment)
  );
}

/**
 * Runs any pending migrations exactly once, taking a one-time snapshot of the
 * user's data before upgrading so a bad migration can be rolled back. Safe to
 * call on every app load (no-ops once the version is current).
 */
export function runMigrations(): void {
  if (typeof window === "undefined") return;
  // Also acts as lightweight startup maintenance for an old safety snapshot.
  getMigrationSafetyBackup();
  const from = getSchemaVersion();
  if (from >= CURRENT_SCHEMA_VERSION) return;

  // Snapshot current data before touching anything (best-effort).
  try {
    const backup: MigrationSafetyBackup = {
      fromVersion: from,
      savedAt: new Date().toISOString(),
      bundle: buildExport(),
    };
    writeJson(STORAGE_KEYS.autoBackup, backup);
  } catch {
    /* backup is best-effort; continue */
  }

  for (let v = from; v < CURRENT_SCHEMA_VERSION; v++) {
    const migrate = MIGRATIONS[v];
    if (migrate) {
      try {
        migrate();
      } catch {
        /* reads are normalized regardless; don't block the app */
      }
    }
  }

  writeJson(STORAGE_KEYS.schemaVersion, CURRENT_SCHEMA_VERSION);
}

/** Restores the migration snapshot, replacing current workouts/history/body data. */
export function restoreMigrationSafetyBackup(): boolean {
  const b = getMigrationSafetyBackup();
  if (!b) return false;
  saveWorkouts(Array.isArray(b.bundle.workouts) ? b.bundle.workouts : []);
  saveProgramState({
    version: 1,
    programs: Array.isArray(b.bundle.programs) ? b.bundle.programs : [],
    activeProgramId: b.bundle.activeProgramId,
    progressByProgramId: b.bundle.programProgress,
  });
  writeJson(
    STORAGE_KEYS.completedWorkouts,
    Array.isArray(b.bundle.completedWorkouts) ? b.bundle.completedWorkouts : []
  );
  writeJson(
    STORAGE_KEYS.bodyMetrics,
    Array.isArray(b.bundle.bodyMetrics) ? b.bundle.bodyMetrics : []
  );
  writeJson(
    STORAGE_KEYS.customExercises,
    Array.isArray(b.bundle.customExercises) ? b.bundle.customExercises : []
  );
  if (Array.isArray(b.bundle.exercisePreferences)) {
    writeJson(STORAGE_KEYS.exercisePreferences, {
      version: 1,
      data: b.bundle.exercisePreferences,
    });
  }
  if (Array.isArray(b.bundle.performanceFeedback)) {
    writeJson(STORAGE_KEYS.performanceFeedback, {
      version: 1,
      data: b.bundle.performanceFeedback,
    });
  }
  if (Array.isArray(b.bundle.dailyTrainingStates)) {
    writeJson(STORAGE_KEYS.dailyTrainingState, {
      version: 1,
      data: b.bundle.dailyTrainingStates,
    });
  }
  // Profile + settings were added to the bundle later; restore when present.
  if (b.bundle.bodyProfile && typeof b.bundle.bodyProfile === "object") {
    writeJson(STORAGE_KEYS.bodyProfile, b.bundle.bodyProfile);
  }
  if (b.bundle.settings && typeof b.bundle.settings === "object") {
    writeJson(STORAGE_KEYS.settings, b.bundle.settings);
  }
  if (b.bundle.homeEquipment && typeof b.bundle.homeEquipment === "object") {
    writeJson(STORAGE_KEYS.homeEquipment, b.bundle.homeEquipment);
  }
  if (Array.isArray(b.bundle.nutritionEntries)) {
    writeJson(STORAGE_KEYS.nutritionEntries, {
      version: 1,
      data: b.bundle.nutritionEntries,
    });
  }
  if (b.bundle.nutritionTargets && typeof b.bundle.nutritionTargets === "object") {
    writeJson(STORAGE_KEYS.nutritionTargets, {
      version: 1,
      data: b.bundle.nutritionTargets,
    });
  }
  if (Array.isArray(b.bundle.nutritionDayAdjustments)) {
    writeJson(STORAGE_KEYS.nutritionDayAdjustments, {
      version: 1,
      data: b.bundle.nutritionDayAdjustments,
    });
  }
  if (Array.isArray(b.bundle.customNutritionFoods)) {
    writeJson(STORAGE_KEYS.customNutritionFoods, {
      version: 1,
      data: b.bundle.customNutritionFoods,
    });
  }
  if (Array.isArray(b.bundle.nutritionFoodPreferences)) {
    writeJson(STORAGE_KEYS.nutritionFoodPreferences, {
      version: 1,
      data: b.bundle.nutritionFoodPreferences,
    });
  }
  if (Array.isArray(b.bundle.nutritionSavedMeals)) {
    writeJson(STORAGE_KEYS.nutritionSavedMeals, {
      version: 1,
      data: b.bundle.nutritionSavedMeals,
    });
  }
  return true;
}
