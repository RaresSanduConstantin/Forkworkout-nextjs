// Per-exercise performance analytics derived from completed-workout history.
// Everything is computed from the existing CompletedWorkout snapshots — no new
// persisted data. Used for the in-session "last time / PR" hints and the
// per-exercise progress chart.

import type { CompletedSet, CompletedWorkout, SetUnit } from "./types";
import { getCompletedWorkouts } from "./storage/history-storage";
import { inferUnit, setWeightKg, setVolumeKg, parseDuration, formatSetValue } from "./workout";

/** Normalized key for matching an exercise across sessions. */
export function normalizeExName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Estimated 1-rep max (kg) via the Epley formula. 0 for non-weighted sets. */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

const setUnit = (s: CompletedSet): SetUnit => s.unit ?? inferUnit(s.value);

/** Per-session summary of a single exercise's performance. */
export type ExerciseSessionStat = {
  date: string; // ISO
  dayKey?: string;
  kind: SetUnit; // dominant unit for the exercise that session
  topWeightKg: number; // heaviest done kg set
  topWeightReps: number; // reps at that heaviest set
  bestOneRepMax: number; // best est-1RM over done kg sets
  volumeKg: number; // Σ reps×weight over done kg sets
  bestReps: number; // most reps in a done set (for bw)
  bestDurationSec: number; // longest done time set
  bestDistanceKm: number; // longest done km set
  doneSets: number;
};

function summarizeExercise(sets: CompletedSet[], date: string, dayKey?: string): ExerciseSessionStat {
  // Warm-up sets don't count toward performance stats.
  const done = sets.filter((s) => s.status === "done" && s.type !== "warmup");
  let topWeightKg = 0,
    topWeightReps = 0,
    bestOneRepMax = 0,
    volumeKg = 0,
    bestReps = 0,
    bestDurationSec = 0,
    bestDistanceKm = 0;
  const counts: Record<SetUnit, number> = { kg: 0, bw: 0, time: 0, km: 0 };

  for (const s of done) {
    const u = setUnit(s);
    counts[u] += 1;
    if (u === "kg") {
      const w = setWeightKg(s.value, u);
      if (w > topWeightKg) {
        topWeightKg = w;
        topWeightReps = s.reps;
      }
      bestOneRepMax = Math.max(bestOneRepMax, estimateOneRepMax(w, s.reps));
      volumeKg += setVolumeKg(s.reps, s.value, u);
    } else if (u === "bw") {
      bestReps = Math.max(bestReps, s.reps);
    } else if (u === "time") {
      bestDurationSec = Math.max(bestDurationSec, parseDuration(s.value));
    } else if (u === "km") {
      bestDistanceKm = Math.max(bestDistanceKm, parseFloat(s.value) || 0);
    }
  }

  // Dominant unit = the one with the most done sets (ties → kg > bw > time > km).
  const kind = (["kg", "bw", "time", "km"] as SetUnit[]).reduce((a, b) =>
    counts[b] > counts[a] ? b : a
  );

  return {
    date,
    dayKey,
    kind,
    topWeightKg,
    topWeightReps,
    bestOneRepMax,
    volumeKg,
    bestReps,
    bestDurationSec,
    bestDistanceKm,
    doneSets: done.length,
  };
}

/**
 * All sessions (oldest→newest) in which the exercise appeared and had at least
 * one completed set, each summarized. Optionally scoped to a provided history.
 */
export function getExerciseHistory(
  name: string,
  history: CompletedWorkout[] = getCompletedWorkouts()
): ExerciseSessionStat[] {
  const target = normalizeExName(name);
  const out: ExerciseSessionStat[] = [];
  for (const w of history) {
    if (!w.exercises) continue;
    for (const ex of w.exercises) {
      if (normalizeExName(ex.name) !== target) continue;
      const stat = summarizeExercise(ex.sets, w.date, w.dayKey);
      if (stat.doneSets > 0) out.push(stat);
    }
  }
  out.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return out;
}

/** The most recent prior session summary for the exercise, or null. */
export function getLastPerformance(
  name: string,
  history?: CompletedWorkout[]
): ExerciseSessionStat | null {
  const all = getExerciseHistory(name, history);
  return all.length ? all[all.length - 1] : null;
}

/**
 * The raw per-set data from the most recent prior session in which the exercise
 * appeared (index-aligned to how it was performed). Used for the in-session
 * "beat your last numbers" ghost placeholders. Empty when there's no history.
 */
export function getLastSessionSets(
  name: string,
  history: CompletedWorkout[] = getCompletedWorkouts()
): CompletedSet[] {
  const target = normalizeExName(name);
  let latest: { time: number; sets: CompletedSet[] } | null = null;
  for (const w of history) {
    if (!w.exercises) continue;
    for (const ex of w.exercises) {
      if (normalizeExName(ex.name) !== target) continue;
      if (!ex.sets || ex.sets.length === 0) continue;
      const time = new Date(w.date).getTime();
      if (!latest || time > latest.time) latest = { time, sets: ex.sets };
    }
  }
  return latest?.sets ?? [];
}

/** Distinct exercise names that appear in history (most-recent activity first). */
export function getAllExerciseNames(
  history: CompletedWorkout[] = getCompletedWorkouts()
): string[] {
  const seen = new Map<string, { name: string; time: number }>();
  for (const w of history) {
    if (!w.exercises) continue;
    const time = new Date(w.date).getTime();
    for (const ex of w.exercises) {
      if (!ex.name?.trim()) continue;
      const key = normalizeExName(ex.name);
      const prev = seen.get(key);
      if (!prev || time > prev.time) seen.set(key, { name: ex.name.trim(), time });
    }
  }
  return [...seen.values()].sort((a, b) => b.time - a.time).map((e) => e.name);
}

/** Best-ever numbers for the exercise across all history. */
export type ExercisePR = {
  kind: SetUnit;
  bestOneRepMax: number;
  maxWeightKg: number;
  maxWeightReps: number;
  bestReps: number;
  bestDurationSec: number;
  bestDistanceKm: number;
} | null;

export function getExercisePR(name: string, history?: CompletedWorkout[]): ExercisePR {
  const all = getExerciseHistory(name, history);
  if (!all.length) return null;
  const pr = {
    kind: all[all.length - 1].kind,
    bestOneRepMax: 0,
    maxWeightKg: 0,
    maxWeightReps: 0,
    bestReps: 0,
    bestDurationSec: 0,
    bestDistanceKm: 0,
  };
  for (const s of all) {
    if (s.topWeightKg > pr.maxWeightKg) {
      pr.maxWeightKg = s.topWeightKg;
      pr.maxWeightReps = s.topWeightReps;
    }
    pr.bestOneRepMax = Math.max(pr.bestOneRepMax, s.bestOneRepMax);
    pr.bestReps = Math.max(pr.bestReps, s.bestReps);
    pr.bestDurationSec = Math.max(pr.bestDurationSec, s.bestDurationSec);
    pr.bestDistanceKm = Math.max(pr.bestDistanceKm, s.bestDistanceKm);
  }
  return pr;
}

/**
 * A gentle progressive-overload nudge (kg only): if the last session's heaviest
 * set was a whole workout done at a consistent top weight, suggest +2.5 kg.
 * Returns the suggested weight (kg) or null.
 */
export function suggestNextWeight(name: string, history?: CompletedWorkout[]): number | null {
  const last = getLastPerformance(name, history);
  if (!last || last.kind !== "kg" || last.topWeightKg <= 0) return null;
  return Math.round((last.topWeightKg + 2.5) * 10) / 10;
}

/**
 * Typical real duration (seconds) of a workout, from the average of its most
 * recent completed sessions. Lets the live tracker show a target based on how
 * long it actually takes you rather than a naive estimate. Returns null when
 * the workout has never been completed (no recorded duration).
 */
export function getTypicalDurationSec(
  workoutId: string,
  history: CompletedWorkout[] = getCompletedWorkouts(),
  sampleSize = 5
): number | null {
  const durations = history
    .filter((w) => w.workoutId === workoutId && (w.durationSec ?? 0) > 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, sampleSize)
    .map((w) => w.durationSec as number);
  if (durations.length === 0) return null;
  const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  return Math.round(avg);
}

/** Short human label for a session's headline set (e.g. "60 kg × 8", "45s"). */
export function describeTopSet(stat: ExerciseSessionStat): string {
  if (stat.kind === "kg" && stat.topWeightKg > 0) {
    return `${formatSetValue(String(stat.topWeightKg), "kg")} × ${stat.topWeightReps}`;
  }
  if (stat.kind === "bw") return `${stat.bestReps} reps`;
  if (stat.kind === "time" && stat.bestDurationSec > 0) {
    return formatSetValue(`${stat.bestDurationSec}s`, "time");
  }
  if (stat.kind === "km" && stat.bestDistanceKm > 0) {
    return formatSetValue(String(stat.bestDistanceKm), "km");
  }
  return `${stat.doneSets} set${stat.doneSets === 1 ? "" : "s"}`;
}
