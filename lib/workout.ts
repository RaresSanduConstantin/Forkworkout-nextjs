import type { SetType, SetUnit } from "./types";

export const SET_UNITS: { value: SetUnit; label: string }[] = [
  { value: "kg", label: "Kg" },
  { value: "bw", label: "BW" },
  { value: "time", label: "Time" },
  { value: "km", label: "Km" },
];

// Set types. "working" is the default (undefined is treated as working). Warm-up
// sets are excluded from volume, rep totals, PRs and 1RM estimates.
export const SET_TYPES: { value: SetType; label: string; short: string }[] = [
  { value: "working", label: "Working set", short: "Work" },
  { value: "warmup", label: "Warm-up", short: "Warm" },
  { value: "drop", label: "Drop set", short: "Drop" },
  { value: "failure", label: "To failure", short: "Fail" },
];

/** Short badge label for a set type; empty for a plain working set. */
export function setTypeShort(type?: SetType): string {
  if (!type || type === "working") return "";
  return SET_TYPES.find((t) => t.value === type)?.short ?? "";
}

/** Whether a set counts toward volume / reps / PRs (everything but warm-ups). */
export function setCountsForStats(type?: SetType): boolean {
  return type !== "warmup";
}

/**
 * Infers a set's unit from an existing unit or a legacy free-text value.
 * Legacy values looked like "60kg", "BW", "1min", or a bare number.
 */
export function inferUnit(value: string | undefined, existing?: string): SetUnit {
  if (existing === "kg" || existing === "bw" || existing === "time" || existing === "km")
    return existing;
  const v = (value ?? "").trim().toLowerCase();
  if (!v) return "kg";
  if (v === "bw" || v.includes("bodyweight")) return "bw";
  if (/(min|sec|hour|:|\d\s*s\b|\d\s*h\b)/.test(v)) return "time";
  if (/km/.test(v)) return "km";
  if (/(kg|lb)/.test(v)) return "kg";
  if (/^[\d.]+$/.test(v)) return "kg"; // bare number → weight
  return "time";
}

/**
 * Normalizes a raw value+unit pair into the canonical shape:
 * - kg / km: value = numeric string only (e.g. "60")
 * - bw:      value = "BW"
 * - time:    value = kept as-is
 */
export function normalizeUnitValue(
  rawValue: string | undefined,
  rawUnit?: string
): { unit: SetUnit; value: string } {
  const unit = inferUnit(rawValue, rawUnit);
  const raw = (rawValue ?? "").trim();
  if (unit === "kg" || unit === "km") return { unit, value: raw.match(/[\d.]+/)?.[0] ?? "" };
  if (unit === "bw") return { unit, value: "BW" };
  return { unit, value: raw };
}

/** Weight in kg for a set, or 0 when it isn't a weighted (kg) set. */
export function setWeightKg(value: string, unit?: SetUnit): number {
  if (unit && unit !== "kg") return 0;
  const w = parseFloat(value);
  return Number.isFinite(w) ? w : 0;
}

/** Volume (kg) contributed by a set = reps × weight, only for kg sets. */
export function setVolumeKg(reps: number, value: string, unit?: SetUnit): number {
  const u = unit ?? inferUnit(value);
  if (u !== "kg") return 0;
  return reps * setWeightKg(value, u);
}

/** Human-readable load label for a set (e.g. "60 kg", "BW", "45s", "5 km"). */
export function formatSetValue(value: string, unit?: SetUnit): string {
  const u = unit ?? inferUnit(value);
  if (u === "bw") return "BW";
  if (u === "kg") return value ? `${value} kg` : "—";
  if (u === "km") return value ? `${value} km` : "—";
  return value || "—";
}

/** Placeholder text for the value input, by unit. */
export function unitPlaceholder(unit: SetUnit): string {
  if (unit === "kg") return "kg";
  if (unit === "km") return "km";
  if (unit === "time") return "e.g. 45s, 1min";
  return "";
}

/**
 * Parses a duration string into seconds. Handles "45s", "1min", "10 min",
 * "1:30" (mm:ss), and bare numbers (treated as seconds). Returns 0 if unknown.
 */
export function parseDuration(value: string): number {
  const v = (value ?? "").trim().toLowerCase();
  if (!v) return 0;
  if (v.includes(":")) {
    const parts = v.split(":").map((p) => parseInt(p, 10) || 0);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  const num = parseFloat(v);
  if (!Number.isFinite(num)) return 0;
  if (v.includes("h")) return Math.round(num * 3600);
  if (v.includes("min")) return Math.round(num * 60);
  return Math.round(num); // seconds ("45s" or bare number)
}

/** Formats seconds as a clock string: "m:ss" or "h:mm:ss". */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/**
 * Human-readable duration for estimates, e.g. "~17 min" or "~1h 5min".
 * Rounds to the nearest minute (minimum 1 min for any non-zero time).
 */
export function formatEstimate(totalSeconds: number): string {
  const mins = Math.max(0, Math.round(totalSeconds / 60));
  if (mins === 0) return "~0 min";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return m > 0 ? `~${h}h ${m}min` : `~${h}h`;
  return `~${m} min`;
}

// ---- Per-exercise rest -----------------------------------------------------

/** Max per-exercise rest in the cycle (5 minutes). */
const MAX_REST = 300;

/** Human-readable rest/duration, e.g. "Off", "45s", "1 min 30s". */
export function restDurationLabel(sec: number): string {
  if (sec <= 0) return "Off";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m} min ${s}s` : `${s}s`;
}

/** Rest values in seconds from 5s to MAX_REST (5 minutes), in 5s steps. */
const REST_STEPS = Array.from({ length: MAX_REST / 5 }, (_, i) => (i + 1) * 5);

/** Options for the workout-level default rest select: Off, 5s … 5:00. */
export const WORKOUT_REST_OPTIONS: { value: string; label: string }[] = [
  { value: "0", label: "Off" },
  ...REST_STEPS.map((sec) => ({ value: String(sec), label: restDurationLabel(sec) })),
];

/** Options for a per-exercise rest select: Default, Off, 5s … 5:00. */
export const EXERCISE_REST_OPTIONS: { value: string; label: string }[] = [
  { value: "default", label: "Default" },
  ...WORKOUT_REST_OPTIONS,
];

/**
 * Cycles a per-exercise rest value: Default (undefined) → Off ("0") → 5s → 10s
 * → … → 5:00 → Default. Steps of 5 seconds.
 */
export function cycleRest(rest: string | undefined): string | undefined {
  if (rest === undefined || rest === "") return "0";
  const sec = parseInt(rest, 10) || 0;
  if (sec >= MAX_REST) return undefined; // wrap back to Default
  return String(Math.min(MAX_REST, sec === 0 ? 5 : sec + 5));
}

/** Button label for a per-exercise rest value. */
export function formatRestLabel(rest: string | undefined): string {
  if (rest === undefined || rest === "") return "Rest Timer: Default";
  const sec = parseInt(rest, 10) || 0;
  return `Rest Timer: ${restDurationLabel(sec)}`;
}

/** Effective rest (seconds) for an exercise: its own override, else the workout default. */
export function effectiveRestSeconds(
  exerciseRest: string | undefined,
  workoutRest: string | undefined
): number {
  const src =
    exerciseRest !== undefined && exerciseRest !== "" ? exerciseRest : workoutRest ?? "";
  return parseInt(src, 10) || 0;
}

// ---- Time estimate ---------------------------------------------------------

/**
 * Estimates total workout time in seconds. Assumes ~50s of work per weighted
 * set (or the set's own duration for time sets), an implicit rest between sets
 * (at least 30s even when rest is off), and a short transition per exercise.
 * Shared by the live session and the workout generator so they agree.
 */
export function estimateWorkoutSeconds(
  exercises: { sets: { unit?: SetUnit; value: string }[]; rest?: string }[],
  workoutRest?: string
): number {
  let total = 0;
  for (const ex of exercises) {
    const restBetween = Math.max(effectiveRestSeconds(ex.rest, workoutRest), 30);
    let work = 0;
    for (const set of ex.sets) {
      work += set.unit === "time" ? parseDuration(set.value) || 30 : 50;
    }
    total += work + restBetween * Math.max(0, ex.sets.length - 1) + 20;
  }
  return Math.round(total);
}
