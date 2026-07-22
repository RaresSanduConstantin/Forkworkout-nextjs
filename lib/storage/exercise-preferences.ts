import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson } from "./safe-storage";

export const EXERCISE_PREFERENCES_VERSION = 1;

export type ExercisePreferenceLevel = "prefer" | "neutral" | "avoid";

export type ExercisePreferenceReason =
  | "dislike"
  | "equipment"
  | "difficulty"
  | "discomfort"
  | "temporary"
  | "other";

export type ExercisePreference = {
  exerciseId: string;
  exerciseName?: string;
  level: Exclude<ExercisePreferenceLevel, "neutral">;
  reason?: ExercisePreferenceReason;
  updatedAt: string;
  expiresAt?: string;
};

type ExercisePreferenceEnvelope = {
  version: number;
  data: unknown[];
};

type ExercisePreferenceInput = {
  exerciseId: string;
  exerciseName?: string;
  level: ExercisePreferenceLevel;
  reason?: ExercisePreferenceReason;
  expiresAt?: string;
};

const levels = new Set<ExercisePreference["level"]>(["prefer", "avoid"]);
const reasons = new Set<ExercisePreferenceReason>([
  "dislike",
  "equipment",
  "difficulty",
  "discomfort",
  "temporary",
  "other",
]);

function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function normalize(raw: unknown): ExercisePreference | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const exerciseId = typeof value.exerciseId === "string" ? value.exerciseId.trim() : "";
  if (!exerciseId || !levels.has(value.level as ExercisePreference["level"])) return null;

  const preference: ExercisePreference = {
    exerciseId,
    level: value.level as ExercisePreference["level"],
    updatedAt: validDate(value.updatedAt) ? value.updatedAt : new Date(0).toISOString(),
  };
  if (typeof value.exerciseName === "string" && value.exerciseName.trim()) {
    preference.exerciseName = value.exerciseName.trim();
  }
  if (reasons.has(value.reason as ExercisePreferenceReason)) {
    preference.reason = value.reason as ExercisePreferenceReason;
  }
  if (validDate(value.expiresAt)) preference.expiresAt = value.expiresAt;
  return preference;
}

function readAll(): ExercisePreference[] {
  const raw = readJson<unknown>(STORAGE_KEYS.exercisePreferences, null);
  const entries = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as ExercisePreferenceEnvelope).data)
      ? (raw as ExercisePreferenceEnvelope).data
      : [];

  const unique = new Map<string, ExercisePreference>();
  for (const entry of entries) {
    const preference = normalize(entry);
    if (!preference) continue;
    const existing = unique.get(preference.exerciseId);
    if (!existing || Date.parse(preference.updatedAt) >= Date.parse(existing.updatedAt)) {
      unique.set(preference.exerciseId, preference);
    }
  }
  return Array.from(unique.values());
}

export function saveExercisePreferences(preferences: unknown[]): boolean {
  const data = preferences.map(normalize).filter((item): item is ExercisePreference => Boolean(item));
  return writeJson<ExercisePreferenceEnvelope>(STORAGE_KEYS.exercisePreferences, {
    version: EXERCISE_PREFERENCES_VERSION,
    data,
  });
}

/** Returns active preferences only. Temporary avoids expire without destructive reads. */
export function getExercisePreferences(now = Date.now()): ExercisePreference[] {
  return readAll().filter(
    (preference) => !preference.expiresAt || Date.parse(preference.expiresAt) > now
  );
}

export function getExercisePreference(
  exerciseId: string,
  now = Date.now()
): ExercisePreference | null {
  return getExercisePreferences(now).find((item) => item.exerciseId === exerciseId) ?? null;
}

export function setExercisePreference(input: ExercisePreferenceInput): boolean {
  const exerciseId = input.exerciseId.trim();
  if (!exerciseId) return false;

  const current = readAll().filter((item) => item.exerciseId !== exerciseId);
  if (input.level === "neutral") return saveExercisePreferences(current);

  return saveExercisePreferences([
    ...current,
    {
      exerciseId,
      exerciseName: input.exerciseName?.trim() || undefined,
      level: input.level,
      reason: input.level === "avoid" ? input.reason : undefined,
      updatedAt: new Date().toISOString(),
      expiresAt: input.level === "avoid" ? input.expiresAt : undefined,
    },
  ]);
}

export function removeExercisePreference(exerciseId: string): boolean {
  return saveExercisePreferences(readAll().filter((item) => item.exerciseId !== exerciseId));
}
