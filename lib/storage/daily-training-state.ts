import type { MuscleTargetKey } from "@/lib/exercises";
import { toDayKey } from "@/lib/date/day-key";
import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson } from "./safe-storage";

export const DAILY_TRAINING_STATE_VERSION = 1;
const MAX_DAILY_STATES = 14;

export type ReadinessLevel = "great" | "normal" | "tired" | "very-tired";

export type DailyTrainingState = {
  date: string;
  readiness: ReadinessLevel;
  soreMuscles: MuscleTargetKey[];
  avoidMuscles: MuscleTargetKey[];
};

type DailyStateEnvelope = {
  version: number;
  data: unknown[];
};

const readinessValues = new Set<ReadinessLevel>([
  "great",
  "normal",
  "tired",
  "very-tired",
]);
const muscleValues = new Set<MuscleTargetKey>([
  "chest",
  "lats",
  "lowerback",
  "traps",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "abs",
  "obliques",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
]);

function validDayKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

function normalizeMuscles(value: unknown): MuscleTargetKey[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.filter((muscle): muscle is MuscleTargetKey => muscleValues.has(muscle)))
  );
}

function normalize(raw: unknown): DailyTrainingState | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (!validDayKey(value.date)) return null;
  return {
    date: value.date,
    readiness: readinessValues.has(value.readiness as ReadinessLevel)
      ? (value.readiness as ReadinessLevel)
      : "normal",
    soreMuscles: normalizeMuscles(value.soreMuscles),
    avoidMuscles: normalizeMuscles(value.avoidMuscles),
  };
}

export function getDailyTrainingStates(): DailyTrainingState[] {
  const raw = readJson<unknown>(STORAGE_KEYS.dailyTrainingState, null);
  const entries = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as DailyStateEnvelope).data)
      ? (raw as DailyStateEnvelope).data
      : [];
  const byDate = new Map<string, DailyTrainingState>();
  for (const entry of entries) {
    const state = normalize(entry);
    if (state) byDate.set(state.date, state);
  }
  return Array.from(byDate.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-MAX_DAILY_STATES);
}

export function saveDailyTrainingState(state: DailyTrainingState): boolean {
  const normalized = normalize(state);
  if (!normalized) return false;
  const states = getDailyTrainingStates().filter((entry) => entry.date !== normalized.date);
  return writeJson<DailyStateEnvelope>(STORAGE_KEYS.dailyTrainingState, {
    version: DAILY_TRAINING_STATE_VERSION,
    data: [...states, normalized]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-MAX_DAILY_STATES),
  });
}

export function getDailyTrainingState(date: Date = new Date()): DailyTrainingState {
  const dayKey = toDayKey(date);
  return (
    getDailyTrainingStates().find((state) => state.date === dayKey) ?? {
      date: dayKey,
      readiness: "normal",
      soreMuscles: [],
      avoidMuscles: [],
    }
  );
}
