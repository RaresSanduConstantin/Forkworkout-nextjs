import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import { v4 as uuidv4 } from "uuid";

import type { Workout, WorkoutProgram } from "@/lib/types";
import { decodeWorkout, encodeWorkout, type DecodedShare } from "./share";

type ProgramSharePayload = {
  v: 1;
  type: "program";
  title: string;
  msg?: string;
  workouts: string[];
};

const MAX_ENCODED_LENGTH = 16000;

export type DecodedProgramShare = {
  program: WorkoutProgram;
  workouts: Workout[];
  customExercises: DecodedShare["customExercises"];
  message?: string;
};

export function encodeProgram(
  program: WorkoutProgram,
  workouts: Workout[],
  message?: string,
  maxEncodedLength = MAX_ENCODED_LENGTH
): string | null {
  const ordered = program.workoutIds
    .map((id) => workouts.find((workout) => workout.id === id))
    .filter((workout): workout is Workout => !!workout);
  if (ordered.length === 0) return null;
  const encodedWorkouts = ordered.map((workout) =>
    encodeWorkout(workout, undefined, maxEncodedLength)
  );
  if (encodedWorkouts.some((encoded) => !encoded)) return null;
  const payload: ProgramSharePayload = {
    v: 1,
    type: "program",
    title: program.title,
    msg: message?.trim().slice(0, 280) || undefined,
    workouts: encodedWorkouts as string[],
  };
  const encoded = compressToEncodedURIComponent(JSON.stringify(payload));
  return encoded.length > maxEncodedLength ? null : encoded;
}

export function buildProgramShareUrl(
  program: WorkoutProgram,
  workouts: Workout[],
  origin: string,
  message?: string
): string | null {
  const encoded = encodeProgram(program, workouts, message);
  if (!encoded) return null;
  return `${origin}/app#importProgram=${encoded}`;
}

export function decodeProgram(encoded: string): DecodedProgramShare | null {
  let raw: unknown;
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as Record<string, unknown>;
  if (payload.type !== "program" || !Array.isArray(payload.workouts)) return null;
  const decoded = payload.workouts
    .filter((item): item is string => typeof item === "string")
    .map(decodeWorkout);
  if (decoded.length === 0 || decoded.some((item) => !item)) return null;
  const valid = decoded as DecodedShare[];
  const now = new Date().toISOString();
  const workouts = valid.map((item) => item.workout);
  const customByName = new Map(
    valid
      .flatMap((item) => item.customExercises)
      .map((exercise) => [exercise.name.toLowerCase(), exercise])
  );
  return {
    program: {
      id: uuidv4(),
      title:
        typeof payload.title === "string" && payload.title.trim()
          ? payload.title.trim().slice(0, 60)
          : "Shared program",
      workoutIds: workouts.map((workout) => workout.id),
      createdAt: now,
      updatedAt: now,
    },
    workouts,
    customExercises: [...customByName.values()],
    message:
      typeof payload.msg === "string" && payload.msg.trim()
        ? payload.msg.trim().slice(0, 280)
        : undefined,
  };
}
