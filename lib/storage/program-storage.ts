import { v4 as uuidv4 } from "uuid";

import type { CompletedWorkout, Workout, WorkoutProgram } from "@/lib/types";
import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson } from "./safe-storage";

type ProgramState = {
  version: 1;
  activeProgramId?: string;
  programs: WorkoutProgram[];
};

const EMPTY_STATE: ProgramState = { version: 1, programs: [] };

function normalizeProgram(raw: unknown): WorkoutProgram | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== "string" || !value.id) return null;
  const workoutIds = Array.isArray(value.workoutIds)
    ? [...new Set(value.workoutIds.filter((id): id is string => typeof id === "string" && !!id))]
    : [];
  return {
    id: value.id,
    title:
      typeof value.title === "string" && value.title.trim()
        ? value.title.trim().slice(0, 60)
        : "My program",
    workoutIds,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : undefined,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : undefined,
  };
}

export function getProgramState(): ProgramState {
  const raw = readJson<unknown>(STORAGE_KEYS.programs, EMPTY_STATE);
  if (!raw || typeof raw !== "object") return EMPTY_STATE;
  const value = raw as Record<string, unknown>;
  const programs = Array.isArray(value.programs)
    ? value.programs.map(normalizeProgram).filter((program): program is WorkoutProgram => !!program)
    : [];
  const activeProgramId =
    typeof value.activeProgramId === "string" &&
    programs.some((program) => program.id === value.activeProgramId)
      ? value.activeProgramId
      : programs[0]?.id;
  return { version: 1, activeProgramId, programs };
}

export function saveProgramState(state: ProgramState): boolean {
  const programs = state.programs
    .map(normalizeProgram)
    .filter((program): program is WorkoutProgram => !!program);
  const activeProgramId = programs.some((program) => program.id === state.activeProgramId)
    ? state.activeProgramId
    : programs[0]?.id;
  return writeJson(STORAGE_KEYS.programs, { version: 1, activeProgramId, programs });
}

export function createProgram(title: string, workoutIds: string[]): WorkoutProgram | null {
  const cleanTitle = title.trim();
  const ids = [...new Set(workoutIds.filter(Boolean))];
  if (!cleanTitle || ids.length === 0) return null;
  const state = getProgramState();
  const now = new Date().toISOString();
  const program: WorkoutProgram = {
    id: uuidv4(),
    title: cleanTitle.slice(0, 60),
    workoutIds: ids,
    createdAt: now,
    updatedAt: now,
  };
  if (!saveProgramState({
    ...state,
    activeProgramId: state.activeProgramId ?? program.id,
    programs: [...state.programs, program],
  })) return null;
  return program;
}

export function upsertProgram(program: WorkoutProgram): boolean {
  const state = getProgramState();
  const index = state.programs.findIndex((item) => item.id === program.id);
  const next = { ...program, updatedAt: new Date().toISOString() };
  const programs = [...state.programs];
  if (index === -1) programs.push(next);
  else programs[index] = next;
  return saveProgramState({ ...state, programs });
}

export function deleteProgram(id: string): boolean {
  const state = getProgramState();
  return saveProgramState({
    ...state,
    programs: state.programs.filter((program) => program.id !== id),
  });
}

export function setActiveProgram(id: string): boolean {
  const state = getProgramState();
  if (!state.programs.some((program) => program.id === id)) return false;
  return saveProgramState({ ...state, activeProgramId: id });
}

/** Removes dangling workout references after a workout is deleted. */
export function removeWorkoutFromPrograms(workoutId: string): boolean {
  const state = getProgramState();
  return saveProgramState({
    ...state,
    programs: state.programs.map((program) => ({
      ...program,
      workoutIds: program.workoutIds.filter((id) => id !== workoutId),
    })),
  });
}

export function getNextProgramWorkout(
  program: WorkoutProgram,
  workouts: Workout[],
  history: CompletedWorkout[]
): { workout: Workout; position: number; total: number } | null {
  const ordered = program.workoutIds
    .map((id) => workouts.find((workout) => workout.id === id))
    .filter((workout): workout is Workout => !!workout);
  if (ordered.length === 0) return null;
  const ids = new Set(ordered.map((workout) => workout.id));
  const latest = history
    .filter((entry) => ids.has(entry.workoutId))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
  const lastIndex = latest ? ordered.findIndex((workout) => workout.id === latest.workoutId) : -1;
  const position = (lastIndex + 1) % ordered.length;
  return { workout: ordered[position], position, total: ordered.length };
}
