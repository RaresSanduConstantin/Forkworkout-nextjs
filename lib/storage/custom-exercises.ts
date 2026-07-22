// User-added ("custom") exercises, stored locally. They're merged into the
// shared exercise library (see lib/exercises.ts) so they flow through the
// combobox, info dialog, video modal, recommendations and history like any
// bundled exercise. `defaultUnit` drives how the exercise is measured so its
// history stats (volume / time / distance) come out right.

import type { SetUnit } from "@/lib/types";
import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson } from "./safe-storage";

export type CustomExercise = {
  name: string;
  force: string | null;
  level: string;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  custom: true;
  defaultUnit: SetUnit; // kg | bw | time | km
  videoUrl?: string; // optional YouTube URL for the in-app demo
  createdAt: string;
  /** Bundled exercise name when this entry is a local, resettable override. */
  sourceName?: string;
};

export type CustomExerciseInput = {
  name: string;
  defaultUnit: SetUnit;
  force?: string | null;
  level?: string;
  mechanic?: string | null;
  category?: string;
  equipment?: string | null;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  instructions?: string[];
  videoUrl?: string;
  sourceName?: string;
};

const UNITS: SetUnit[] = ["kg", "bw", "time", "km"];

const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.trim() !== "") : [];

function normalize(raw: unknown): CustomExercise | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const name = typeof e.name === "string" ? e.name.trim() : "";
  if (!name) return null;
  const defaultUnit = UNITS.includes(e.defaultUnit as SetUnit)
    ? (e.defaultUnit as SetUnit)
    : "kg";
  return {
    name,
    force: typeof e.force === "string" && e.force ? e.force : null,
    level: typeof e.level === "string" && e.level ? e.level : "beginner",
    mechanic: typeof e.mechanic === "string" ? e.mechanic : null,
    equipment: typeof e.equipment === "string" && e.equipment ? e.equipment : null,
    primaryMuscles: asStringArray(e.primaryMuscles),
    secondaryMuscles: asStringArray(e.secondaryMuscles),
    instructions: asStringArray(e.instructions),
    category: typeof e.category === "string" && e.category ? e.category : "strength",
    custom: true,
    defaultUnit,
    videoUrl: typeof e.videoUrl === "string" && e.videoUrl.trim() ? e.videoUrl.trim() : undefined,
    createdAt: typeof e.createdAt === "string" ? e.createdAt : new Date().toISOString(),
    sourceName:
      typeof e.sourceName === "string" && e.sourceName.trim()
        ? e.sourceName.trim()
        : undefined,
  };
}

/** All custom exercises, normalized. */
export function getCustomExercises(): CustomExercise[] {
  const raw = readJson<unknown[]>(STORAGE_KEYS.customExercises, []);
  if (!Array.isArray(raw)) return [];
  return raw.map(normalize).filter((e): e is CustomExercise => e !== null);
}

export function hasCustomExercises(): boolean {
  return getCustomExercises().length > 0;
}

/**
 * Adds (or replaces, by normalized name) a custom exercise. Returns the stored
 * exercise, or null if the name is empty / persistence failed.
 */
export function addCustomExercise(input: CustomExerciseInput): CustomExercise | null {
  const entry = normalize({ ...input, custom: true, createdAt: new Date().toISOString() });
  if (!entry) return null;
  const all = getCustomExercises().filter(
    (e) => e.name.toLowerCase() !== entry.name.toLowerCase()
  );
  all.push(entry);
  return writeJson(STORAGE_KEYS.customExercises, all) ? entry : null;
}

/** Removes a custom exercise by name (case-insensitive). */
export function deleteCustomExercise(name: string): boolean {
  const target = name.trim().toLowerCase();
  const all = getCustomExercises().filter((e) => e.name.toLowerCase() !== target);
  return writeJson(STORAGE_KEYS.customExercises, all);
}

/**
 * Creates or updates a custom exercise. When `originalName` differs from the new
 * name, the old entry is removed (rename). Returns the stored exercise or null.
 */
export function upsertCustomExercise(
  originalName: string,
  input: CustomExerciseInput
): CustomExercise | null {
  const original = originalName.trim().toLowerCase();
  const nextName = input.name.trim().toLowerCase();
  if (original && original !== nextName) {
    deleteCustomExercise(originalName);
  }
  return addCustomExercise(input);
}

/** Replaces the whole set (used by import/restore). */
export function saveCustomExercises(list: CustomExercise[]): boolean {
  const clean = list.map(normalize).filter((e): e is CustomExercise => e !== null);
  return writeJson(STORAGE_KEYS.customExercises, clean);
}
