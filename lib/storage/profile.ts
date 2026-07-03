// Static body profile used to derive health metrics (BMI, BMR, TDEE, body fat).
// These change rarely, so they're stored once rather than per body-metric entry.
// Reads tolerate missing/corrupt data and fall back to an empty profile.

import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson } from "./safe-storage";

export type BodySex = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

export type BodyProfile = {
  heightCm?: number;
  sex?: BodySex;
  birthYear?: number;
  activity?: ActivityLevel;
};

function posNum(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

function normalize(raw: unknown): BodyProfile {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const currentYear = new Date().getFullYear();
  return {
    heightCm: posNum(r.heightCm, 50, 260),
    sex: r.sex === "male" || r.sex === "female" ? r.sex : undefined,
    birthYear: posNum(r.birthYear, 1900, currentYear),
    activity:
      r.activity === "sedentary" ||
      r.activity === "light" ||
      r.activity === "moderate" ||
      r.activity === "active" ||
      r.activity === "very_active"
        ? r.activity
        : undefined,
  };
}

/** Current body profile, merged with an empty default. */
export function getBodyProfile(): BodyProfile {
  return normalize(readJson<unknown>(STORAGE_KEYS.bodyProfile, null));
}

/** Merge a partial update into the profile and persist it. */
export function updateBodyProfile(patch: Partial<BodyProfile>): BodyProfile {
  const next = normalize({ ...getBodyProfile(), ...patch });
  writeJson(STORAGE_KEYS.bodyProfile, next);
  return next;
}
