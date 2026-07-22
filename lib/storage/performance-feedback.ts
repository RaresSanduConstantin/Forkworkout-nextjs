import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson } from "./safe-storage";

export const PERFORMANCE_FEEDBACK_VERSION = 1;
export const MAX_PERFORMANCE_FEEDBACK_ENTRIES = 500;

export type ExerciseDifficulty = "easy" | "good" | "hard" | "failed" | "painful";

export type ExercisePerformanceFeedback = {
  workoutId: string;
  exerciseId: string;
  exerciseName?: string;
  completedAt: string;
  difficulty: ExerciseDifficulty;
  completedWorkingSets: number;
  plannedWorkingSets: number;
  topWeightKg?: number;
  completedReps?: number[];
};

type FeedbackEnvelope = {
  version: number;
  data: unknown[];
};

const difficulties = new Set<ExerciseDifficulty>([
  "easy",
  "good",
  "hard",
  "failed",
  "painful",
]);

function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : null;
}

function normalize(raw: unknown): ExercisePerformanceFeedback | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const workoutId = typeof value.workoutId === "string" ? value.workoutId.trim() : "";
  const exerciseId = typeof value.exerciseId === "string" ? value.exerciseId.trim() : "";
  const completedWorkingSets = nonNegativeInteger(value.completedWorkingSets);
  const plannedWorkingSets = nonNegativeInteger(value.plannedWorkingSets);
  if (
    !workoutId ||
    !exerciseId ||
    !validDate(value.completedAt) ||
    !difficulties.has(value.difficulty as ExerciseDifficulty) ||
    completedWorkingSets === null ||
    plannedWorkingSets === null
  ) {
    return null;
  }

  const feedback: ExercisePerformanceFeedback = {
    workoutId,
    exerciseId,
    completedAt: value.completedAt,
    difficulty: value.difficulty as ExerciseDifficulty,
    completedWorkingSets: Math.min(completedWorkingSets, plannedWorkingSets),
    plannedWorkingSets,
  };
  if (typeof value.exerciseName === "string" && value.exerciseName.trim()) {
    feedback.exerciseName = value.exerciseName.trim();
  }
  if (
    typeof value.topWeightKg === "number" &&
    Number.isFinite(value.topWeightKg) &&
    value.topWeightKg > 0
  ) {
    feedback.topWeightKg = value.topWeightKg;
  }
  if (Array.isArray(value.completedReps)) {
    feedback.completedReps = value.completedReps
      .map(nonNegativeInteger)
      .filter((reps): reps is number => reps !== null);
  }
  return feedback;
}

function entryKey(feedback: ExercisePerformanceFeedback): string {
  return `${feedback.workoutId}\u0000${feedback.exerciseId}\u0000${feedback.completedAt}`;
}

export function getPerformanceFeedback(): ExercisePerformanceFeedback[] {
  const raw = readJson<unknown>(STORAGE_KEYS.performanceFeedback, null);
  const entries = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as FeedbackEnvelope).data)
      ? (raw as FeedbackEnvelope).data
      : [];

  const unique = new Map<string, ExercisePerformanceFeedback>();
  for (const entry of entries) {
    const feedback = normalize(entry);
    if (feedback) unique.set(entryKey(feedback), feedback);
  }
  return Array.from(unique.values())
    .sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt))
    .slice(-MAX_PERFORMANCE_FEEDBACK_ENTRIES);
}

export function savePerformanceFeedback(feedback: unknown[]): boolean {
  const unique = new Map<string, ExercisePerformanceFeedback>();
  for (const entry of feedback) {
    const normalized = normalize(entry);
    if (normalized) unique.set(entryKey(normalized), normalized);
  }
  const data = Array.from(unique.values())
    .sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt))
    .slice(-MAX_PERFORMANCE_FEEDBACK_ENTRIES);
  return writeJson<FeedbackEnvelope>(STORAGE_KEYS.performanceFeedback, {
    version: PERFORMANCE_FEEDBACK_VERSION,
    data,
  });
}

export function addPerformanceFeedback(feedback: ExercisePerformanceFeedback): boolean {
  return savePerformanceFeedback([...getPerformanceFeedback(), feedback]);
}

export function getLatestExerciseFeedback(
  exerciseId: string,
  feedback = getPerformanceFeedback()
): ExercisePerformanceFeedback | null {
  let latest: ExercisePerformanceFeedback | null = null;
  for (const entry of feedback) {
    if (
      entry.exerciseId === exerciseId &&
      (!latest || Date.parse(entry.completedAt) > Date.parse(latest.completedAt))
    ) {
      latest = entry;
    }
  }
  return latest;
}
