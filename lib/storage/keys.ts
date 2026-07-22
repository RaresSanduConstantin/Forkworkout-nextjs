// Stable LocalStorage keys. Do NOT rename these without a migration — existing
// user data in the wild uses these exact keys.
export const STORAGE_KEYS = {
  workouts: "workouts",
  completedWorkouts: "completedWorkouts",
  bodyMetrics: "forkworkout:body-metrics",
  customExercises: "forkworkout:custom-exercises",
  exercisePreferences: "forkworkout:exercise-preferences",
  performanceFeedback: "forkworkout:performance-feedback",
  dailyTrainingState: "forkworkout:daily-training-state",
  activeSession: "forkworkout:active-session",
  schemaVersion: "forkworkout:schema-version",
  autoBackup: "forkworkout:auto-backup",
  settings: "forkworkout:settings",
  bodyProfile: "forkworkout:body-profile",
  homeEquipment: "forkworkout:home-equipment",
  gdrive: "forkworkout:gdrive",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
