// User preferences persisted on-device. Kept intentionally small; every read
// tolerates missing/corrupt data and falls back to sane defaults so the app
// never crashes because LocalStorage contains unexpected values.

import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson } from "./safe-storage";

export type AppSettings = {
  /** Target number of workout days per week (1–7). */
  weeklyGoal: number;
  /** Whether the first-run onboarding flow has been completed/dismissed. */
  onboardingDone: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  weeklyGoal: 3,
  onboardingDone: false,
};

function normalize(raw: unknown): AppSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SETTINGS };
  const r = raw as Record<string, unknown>;

  const goalNum = typeof r.weeklyGoal === "number" ? r.weeklyGoal : Number(r.weeklyGoal);
  const weeklyGoal = Number.isFinite(goalNum)
    ? Math.min(7, Math.max(1, Math.round(goalNum)))
    : DEFAULT_SETTINGS.weeklyGoal;

  return {
    weeklyGoal,
    onboardingDone: r.onboardingDone === true,
  };
}

/** Current settings, merged with defaults. */
export function getSettings(): AppSettings {
  return normalize(readJson<unknown>(STORAGE_KEYS.settings, null));
}

/** Overwrite settings with a fully-normalized value. */
export function saveSettings(settings: AppSettings): boolean {
  return writeJson(STORAGE_KEYS.settings, normalize(settings));
}

/** Merge a partial update into the current settings and persist. */
export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const next = normalize({ ...getSettings(), ...patch });
  writeJson(STORAGE_KEYS.settings, next);
  return next;
}
