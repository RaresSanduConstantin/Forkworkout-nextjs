import { v4 as uuidv4 } from "uuid";

import type { CompletedWorkout, Workout, WorkoutProgram } from "@/lib/types";
import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson } from "./safe-storage";

export type ProgramProgress = {
  nextWorkoutId: string;
  advancedAt: string;
};

export type ProgramState = {
  version: 1;
  activeProgramId?: string;
  programs: WorkoutProgram[];
  // Optional and backward-compatible: older installs derive progress entirely
  // from history. This marker lets a user advance without recording a workout.
  progressByProgramId?: Record<string, ProgramProgress>;
};

const EMPTY_STATE: ProgramState = { version: 1, programs: [] };

function normalizeProgress(
  raw: unknown,
  programs: WorkoutProgram[]
): Record<string, ProgramProgress> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const programById = new Map(programs.map((program) => [program.id, program]));
  const normalized: Record<string, ProgramProgress> = {};
  for (const [programId, candidate] of Object.entries(raw as Record<string, unknown>)) {
    const program = programById.get(programId);
    if (!program || !candidate || typeof candidate !== "object") continue;
    const value = candidate as Record<string, unknown>;
    if (
      typeof value.nextWorkoutId !== "string" ||
      !program.workoutIds.includes(value.nextWorkoutId) ||
      typeof value.advancedAt !== "string" ||
      !Number.isFinite(Date.parse(value.advancedAt))
    ) {
      continue;
    }
    normalized[programId] = {
      nextWorkoutId: value.nextWorkoutId,
      advancedAt: value.advancedAt,
    };
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

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
  const progressByProgramId = normalizeProgress(value.progressByProgramId, programs);
  return { version: 1, activeProgramId, programs, progressByProgramId };
}

export function saveProgramState(state: ProgramState): boolean {
  const programs = state.programs
    .map(normalizeProgram)
    .filter((program): program is WorkoutProgram => !!program);
  const activeProgramId = programs.some((program) => program.id === state.activeProgramId)
    ? state.activeProgramId
    : programs[0]?.id;
  const progressByProgramId = normalizeProgress(state.progressByProgramId, programs);
  return writeJson(STORAGE_KEYS.programs, {
    version: 1,
    activeProgramId,
    programs,
    progressByProgramId,
  });
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
  const progressByProgramId = { ...state.progressByProgramId };
  delete progressByProgramId[id];
  return saveProgramState({
    ...state,
    programs: state.programs.filter((program) => program.id !== id),
    progressByProgramId,
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
  const progressByProgramId = { ...state.progressByProgramId };
  for (const [programId, progress] of Object.entries(progressByProgramId)) {
    if (progress.nextWorkoutId === workoutId) delete progressByProgramId[programId];
  }
  return saveProgramState({
    ...state,
    programs: state.programs.map((program) => ({
      ...program,
      workoutIds: program.workoutIds.filter((id) => id !== workoutId),
    })),
    progressByProgramId,
  });
}

export function getNextProgramWorkout(
  program: WorkoutProgram,
  workouts: Workout[],
  history: CompletedWorkout[],
  progress?: ProgramProgress
): { workout: Workout; position: number; total: number } | null {
  const ordered = program.workoutIds
    .map((id) => workouts.find((workout) => workout.id === id))
    .filter((workout): workout is Workout => !!workout);
  if (ordered.length === 0) return null;
  const ids = new Set(ordered.map((workout) => workout.id));
  const latest = history
    .filter((entry) => ids.has(entry.workoutId))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0];
  const progressPosition = progress
    ? ordered.findIndex((workout) => workout.id === progress.nextWorkoutId)
    : -1;
  const latestTime = latest ? Date.parse(latest.date) : Number.NEGATIVE_INFINITY;
  const progressTime = progress ? Date.parse(progress.advancedAt) : Number.NEGATIVE_INFINITY;
  if (progressPosition >= 0 && progressTime > latestTime) {
    return { workout: ordered[progressPosition], position: progressPosition, total: ordered.length };
  }
  const lastIndex = latest ? ordered.findIndex((workout) => workout.id === latest.workoutId) : -1;
  const position = (lastIndex + 1) % ordered.length;
  return { workout: ordered[position], position, total: ordered.length };
}

/** Advances a program once without adding a fake completed-workout entry. */
export function skipNextProgramWorkout(
  programId: string,
  workouts: Workout[],
  history: CompletedWorkout[],
  skippedAt = new Date()
): { skipped: Workout; next: Workout; state: ProgramState } | null {
  const state = getProgramState();
  const program = state.programs.find((item) => item.id === programId);
  if (!program) return null;
  const current = getNextProgramWorkout(
    program,
    workouts,
    history,
    state.progressByProgramId?.[programId]
  );
  if (!current || current.total < 2) return null;

  const ordered = program.workoutIds
    .map((id) => workouts.find((workout) => workout.id === id))
    .filter((workout): workout is Workout => !!workout);
  const next = ordered[(current.position + 1) % ordered.length];
  const nextState: ProgramState = {
    ...state,
    progressByProgramId: {
      ...state.progressByProgramId,
      [programId]: {
        nextWorkoutId: next.id,
        advancedAt: skippedAt.toISOString(),
      },
    },
  };
  if (!saveProgramState(nextState)) return null;
  return { skipped: current.workout, next, state: getProgramState() };
}
