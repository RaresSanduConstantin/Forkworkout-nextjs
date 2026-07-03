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
