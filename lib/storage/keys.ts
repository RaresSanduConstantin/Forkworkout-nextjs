// Stable LocalStorage keys. Do NOT rename these without a migration — existing
// user data in the wild uses these exact keys.
export const STORAGE_KEYS = {
  workouts: "workouts",
  completedWorkouts: "completedWorkouts",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
