// Stable LocalStorage keys. Do NOT rename these without a migration — existing
// user data in the wild uses these exact keys.
export const STORAGE_KEYS = {
  workouts: "workouts",
  programs: "forkworkout:programs",
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

export const STORAGE_KEY_VALUES: readonly StorageKey[] = Object.values(STORAGE_KEYS);
export const THEME_STORAGE_KEY = "theme";
export const STORAGE_RESET_KEY = "forkworkout:storage-reset-at";
export const STORAGE_REVISION_KEY = "forkworkout:storage-revision";

// The LocalStorage schema marker is implementation bookkeeping rather than
// user data, so it does not need to be retained in IndexedDB. Theme remains
// LocalStorage-owned because next-themes updates it outside our storage layer.
export const MIRRORED_LOCAL_STORAGE_KEYS: readonly string[] = [
  ...STORAGE_KEY_VALUES.filter((key) => key !== STORAGE_KEYS.schemaVersion),
];
