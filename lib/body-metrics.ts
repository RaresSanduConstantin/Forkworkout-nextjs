// Pure health-metric calculations derived from a body profile + measurements.
// All inputs are metric (kg / cm). Every function returns null when it lacks
// the data it needs, so callers can prompt the user to complete their profile.

import type { ActivityLevel, BodySex } from "./storage/profile";

/** Body Mass Index = kg / m². */
export function computeBMI(weightKg?: number, heightCm?: number): number | null {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  if (m <= 0) return null;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function bmiCategory(bmi: number): { label: string; tone: string } {
  if (bmi < 18.5) return { label: "Underweight", tone: "text-sky-500" };
  if (bmi < 25) return { label: "Healthy", tone: "text-emerald-500" };
  if (bmi < 30) return { label: "Overweight", tone: "text-amber-500" };
  return { label: "Obese", tone: "text-red-500" };
}

/** Age in whole years from a birth year (approximate — year based). */
export function computeAge(birthYear?: number): number | null {
  if (!birthYear) return null;
  const age = new Date().getFullYear() - birthYear;
  return age > 0 && age < 130 ? age : null;
}

/** Basal Metabolic Rate (kcal/day) via the Mifflin-St Jeor equation. */
export function computeBMR(
  weightKg?: number,
  heightCm?: number,
  age?: number | null,
  sex?: BodySex
): number | null {
  if (!weightKg || !heightCm || !age || !sex) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const bmr = sex === "male" ? base + 5 : base - 161;
  return bmr > 0 ? Math.round(bmr) : null;
}

export const ACTIVITY_LEVELS: {
  value: ActivityLevel;
  label: string;
  hint: string;
  factor: number;
}[] = [
  { value: "sedentary", label: "Sedentary", hint: "Little or no exercise", factor: 1.2 },
  { value: "light", label: "Light", hint: "1–3 days/week", factor: 1.375 },
  { value: "moderate", label: "Moderate", hint: "3–5 days/week", factor: 1.55 },
  { value: "active", label: "Active", hint: "6–7 days/week", factor: 1.725 },
  { value: "very_active", label: "Very active", hint: "Hard training / physical job", factor: 1.9 },
];

/** Total Daily Energy Expenditure (kcal/day) = BMR × activity factor. */
export function computeTDEE(bmr: number | null, activity?: ActivityLevel): number | null {
  if (!bmr || !activity) return null;
  const level = ACTIVITY_LEVELS.find((a) => a.value === activity);
  if (!level) return null;
  return Math.round((bmr * level.factor) / 10) * 10;
}

/** Suggested daily calorie targets around maintenance (TDEE). */
export function calorieTargets(
  tdee: number | null
): { cut: number; maintain: number; bulk: number } | null {
  if (!tdee) return null;
  const round = (n: number) => Math.round(n / 10) * 10;
  return { cut: round(tdee - 500), maintain: round(tdee), bulk: round(tdee + 300) };
}

/**
 * Body-fat percentage via the U.S. Navy circumference method (metric).
 * Men need waist + neck; women also need hips. Returns null if inputs are
 * missing or produce an out-of-range result.
 */
export function bodyFatNavy(
  sex: BodySex | undefined,
  heightCm?: number,
  waistCm?: number,
  neckCm?: number,
  hipCm?: number
): number | null {
  if (!sex || !heightCm || !waistCm || !neckCm) return null;
  const log10 = Math.log10;
  let bf: number;
  if (sex === "male") {
    if (waistCm - neckCm <= 0) return null;
    bf =
      495 /
        (1.0324 - 0.19077 * log10(waistCm - neckCm) + 0.15456 * log10(heightCm)) -
      450;
  } else {
    if (!hipCm || waistCm + hipCm - neckCm <= 0) return null;
    bf =
      495 /
        (1.29579 - 0.35004 * log10(waistCm + hipCm - neckCm) + 0.221 * log10(heightCm)) -
      450;
  }
  if (!Number.isFinite(bf) || bf <= 0 || bf > 70) return null;
  return Math.round(bf * 10) / 10;
}

// --- Goal weight projection ------------------------------------------------

export type WeightProjection = {
  start: number; // first weight in the series
  current: number; // latest weight
  goal: number;
  progressPct: number; // 0–100 from start toward goal
  reached: boolean;
  slopePerWeek: number; // signed kg/week trend
  etaWeeks: number | null; // weeks to goal at current pace (null if not trending toward it)
  towardGoal: boolean;
};

/** Least-squares slope (kg/day) of weight over time; null if indeterminate. */
function weightSlopePerDay(points: { date: string; weightKg: number }[]): number | null {
  if (points.length < 2) return null;
  const t0 = new Date(points[0].date).getTime();
  const xs = points.map((p) => (new Date(p.date).getTime() - t0) / 86400000);
  const ys = points.map((p) => p.weightKg);
  const n = xs.length;
  const sx = xs.reduce((a, b) => a + b, 0);
  const sy = ys.reduce((a, b) => a + b, 0);
  const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sxx = xs.reduce((a, x) => a + x * x, 0);
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-9) return null;
  return (n * sxy - sx * sy) / denom;
}

/**
 * Projects progress from the first logged weight toward a goal, using the
 * least-squares trend of the (date-sorted) series to estimate weeks remaining.
 */
export function weightProjection(
  series: { date: string; weightKg: number }[],
  goalKg?: number
): WeightProjection | null {
  if (!goalKg || series.length === 0) return null;
  const pts = [...series].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const start = pts[0].weightKg;
  const current = pts[pts.length - 1].weightKg;

  const losing = goalKg < start;
  const reached =
    Math.abs(current - goalKg) <= 0.25 || (losing ? current <= goalKg : current >= goalKg);

  const total = start - goalKg;
  const done = start - current;
  const progressPct =
    Math.abs(total) < 1e-9
      ? reached
        ? 100
        : 0
      : Math.max(0, Math.min(100, (done / total) * 100));

  const slopeDay = weightSlopePerDay(pts) ?? 0;
  const slopePerWeek = Math.round(slopeDay * 7 * 100) / 100;

  const need = goalKg - current; // signed remaining
  const towardGoal = !reached && slopeDay !== 0 && Math.sign(slopeDay) === Math.sign(need);

  let etaWeeks: number | null = null;
  if (towardGoal) {
    const weeks = need / (slopeDay * 7);
    if (Number.isFinite(weeks) && weeks > 0 && weeks < 260) etaWeeks = Math.ceil(weeks);
  }

  return { start, current, goal: goalKg, progressPct, reached, slopePerWeek, etaWeeks, towardGoal };
}
