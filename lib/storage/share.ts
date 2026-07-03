// Share a workout via a self-contained link — no backend, no account. The whole
// workout is compressed into the URL fragment (kept client-side, never sent to a
// server), so a recipient's ForkWorkout can decode and import it.

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { v4 as uuidv4 } from "uuid";
import type { SetType, SetUnit, Workout } from "@/lib/types";
import { getCustomExercises, addCustomExercise } from "./custom-exercises";

type AddCustomInput = Parameters<typeof addCustomExercise>[0];

// Versioned, id-free payload embedded in the link.
type ShareSet = { reps: number; value: string; unit?: SetUnit; type?: SetType };
type ShareExercise = { name: string; rest?: string; superset?: string; sets: ShareSet[] };
// Definitions for any custom exercises the workout uses, so the recipient gets
// their how-to / video / measurement unit too.
type ShareCustomExercise = {
  name: string;
  unit: SetUnit;
  category?: string;
  equipment?: string | null;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  instructions?: string[];
  video?: string;
};
type SharePayload = {
  v: 1;
  title: string;
  rest?: string;
  msg?: string; // optional message from the sharer
  exercises: ShareExercise[];
  cx?: ShareCustomExercise[];
};

// Keep links comfortably within browser/URL limits. Normal workouts are tiny;
// this guards against pathologically large ones.
const MAX_ENCODED_LENGTH = 8000;
const MAX_MESSAGE_LENGTH = 280;

const UNITS: SetUnit[] = ["kg", "bw", "time", "km"];
const TYPES: SetType[] = ["warmup", "working", "drop", "failure"];

/** Builds the compact, id-free payload for a workout. */
function toPayload(workout: Workout, message?: string): SharePayload {
  // Bundle definitions for any custom exercises this workout uses.
  const names = new Set(workout.exercises.map((e) => e.name.trim().toLowerCase()));
  const cx: ShareCustomExercise[] = getCustomExercises()
    .filter((c) => names.has(c.name.toLowerCase()))
    .map((c) => ({
      name: c.name,
      unit: c.defaultUnit,
      category: c.category,
      equipment: c.equipment,
      primaryMuscles: c.primaryMuscles.length ? c.primaryMuscles : undefined,
      secondaryMuscles: c.secondaryMuscles.length ? c.secondaryMuscles : undefined,
      instructions: c.instructions.length ? c.instructions : undefined,
      video: c.videoUrl,
    }));

  return {
    v: 1,
    title: workout.title,
    rest: workout.rest || undefined,
    msg: message && message.trim() ? message.trim().slice(0, MAX_MESSAGE_LENGTH) : undefined,
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
    cx: cx.length ? cx : undefined,
  };
}

/** Encodes a workout (+ optional message) to a URL-safe string, or null if too large. */
export function encodeWorkout(workout: Workout, message?: string): string | null {
  const encoded = compressToEncodedURIComponent(JSON.stringify(toPayload(workout, message)));
  return encoded.length > MAX_ENCODED_LENGTH ? null : encoded;
}

/** A share link that opens the app's dashboard and offers to import. */
export function buildShareUrl(workout: Workout, origin: string, message?: string): string | null {
  const encoded = encodeWorkout(workout, message);
  if (!encoded) return null;
  return `${origin}/app#import=${encoded}`;
}

/** A decoded share link: the workout plus any custom-exercise definitions it uses. */
export type DecodedShare = {
  workout: Workout;
  customExercises: AddCustomInput[];
};

/** Decodes a shared string into a fresh, persistable Workout (new ids), or null. */
export function decodeWorkout(encoded: string): DecodedShare | null {
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

  // Custom-exercise definitions bundled with the share.
  const customExercises: AddCustomInput[] = [];
  for (const rawCx of Array.isArray(p.cx) ? p.cx : []) {
    const c = (rawCx ?? {}) as Record<string, unknown>;
    const name = typeof c.name === "string" ? c.name.trim() : "";
    if (!name) continue;
    const strArr = (v: unknown): string[] | undefined =>
      Array.isArray(v) ? (v.filter((m): m is string => typeof m === "string")) : undefined;
    customExercises.push({
      name,
      defaultUnit: UNITS.includes(c.unit as SetUnit) ? (c.unit as SetUnit) : "kg",
      category: typeof c.category === "string" ? c.category : undefined,
      equipment: typeof c.equipment === "string" ? c.equipment : null,
      primaryMuscles: strArr(c.primaryMuscles),
      secondaryMuscles: strArr(c.secondaryMuscles),
      instructions: strArr(c.instructions),
      videoUrl: typeof c.video === "string" && c.video.trim() ? c.video.trim() : undefined,
    });
  }

  const rawMsg = typeof p.msg === "string" ? p.msg.trim() : "";
  const workout: Workout = {
    id: uuidv4(),
    title: typeof p.title === "string" && p.title.trim() ? p.title : "Shared workout",
    rest: typeof p.rest === "string" ? p.rest : undefined,
    createdAt: now,
    updatedAt: now,
    shared: true,
    sharedMessage: rawMsg ? rawMsg.slice(0, 280) : undefined,
    exercises,
  };
  return { workout, customExercises };
}
