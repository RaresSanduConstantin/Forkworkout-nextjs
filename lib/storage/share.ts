// Share a workout via a self-contained link — no backend, no account. The whole
// workout is compressed into the URL fragment (kept client-side, never sent to a
// server), so a recipient's ForkWorkout can decode and import it.

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { v4 as uuidv4 } from "uuid";
import type { SetType, SetUnit, Workout } from "@/lib/types";

// Versioned, id-free payload embedded in the link.
type ShareSet = { reps: number; value: string; unit?: SetUnit; type?: SetType };
type ShareExercise = { name: string; rest?: string; superset?: string; sets: ShareSet[] };
type SharePayload = { v: 1; title: string; rest?: string; exercises: ShareExercise[] };

// Keep links comfortably within browser/URL limits. Normal workouts are tiny;
// this guards against pathologically large ones.
const MAX_ENCODED_LENGTH = 8000;

const UNITS: SetUnit[] = ["kg", "bw", "time", "km"];
const TYPES: SetType[] = ["warmup", "working", "drop", "failure"];

/** Builds the compact, id-free payload for a workout. */
function toPayload(workout: Workout): SharePayload {
  return {
    v: 1,
    title: workout.title,
    rest: workout.rest || undefined,
    exercises: workout.exercises.map((ex) => ({
      name: ex.name,
      rest: ex.rest,
      superset: ex.superset,
      sets: ex.sets.map((s) => ({
        reps: s.reps,
        value: s.value,
        unit: s.unit,
        type: s.type,
      })),
    })),
  };
}

/** Encodes a workout to a URL-safe compressed string, or null if too large. */
export function encodeWorkout(workout: Workout): string | null {
  const encoded = compressToEncodedURIComponent(JSON.stringify(toPayload(workout)));
  return encoded.length > MAX_ENCODED_LENGTH ? null : encoded;
}

/** A share link that opens the app's dashboard and offers to import. */
export function buildShareUrl(workout: Workout, origin: string): string | null {
  const encoded = encodeWorkout(workout);
  if (!encoded) return null;
  return `${origin}/app#import=${encoded}`;
}

/** Decodes a shared string into a fresh, persistable Workout (new ids), or null. */
export function decodeWorkout(encoded: string): Workout | null {
  let payload: unknown;
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    payload = JSON.parse(json);
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (!Array.isArray(p.exercises)) return null;

  const now = new Date().toISOString();
  const exercises = p.exercises
    .map((rawEx) => {
      const e = (rawEx ?? {}) as Record<string, unknown>;
      const name = typeof e.name === "string" ? e.name : "";
      const rawSets = Array.isArray(e.sets) ? e.sets : [];
      const sets = rawSets
        .map((rawSet) => {
          const s = (rawSet ?? {}) as Record<string, unknown>;
          const reps =
            typeof s.reps === "number" ? s.reps : Number.parseInt(String(s.reps), 10) || 1;
          const value = typeof s.value === "string" ? s.value : String(s.value ?? "");
          const unit = UNITS.includes(s.unit as SetUnit) ? (s.unit as SetUnit) : "kg";
          const type = TYPES.includes(s.type as SetType) ? (s.type as SetType) : undefined;
          return { id: uuidv4(), reps, value, unit, type };
        })
        .filter((s) => s.value !== "" || s.unit === "bw");
      return {
        id: uuidv4(),
        name,
        rest: typeof e.rest === "string" ? e.rest : undefined,
        superset: typeof e.superset === "string" && e.superset ? e.superset : undefined,
        sets: sets.length > 0 ? sets : [{ id: uuidv4(), reps: 1, value: "", unit: "kg" as SetUnit }],
      };
    })
    .filter((ex) => ex.name);

  if (exercises.length === 0) return null;

  return {
    id: uuidv4(),
    title: typeof p.title === "string" && p.title.trim() ? p.title : "Shared workout",
    rest: typeof p.rest === "string" ? p.rest : undefined,
    createdAt: now,
    updatedAt: now,
    exercises,
  };
}
