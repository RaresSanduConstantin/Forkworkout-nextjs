// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import type { CompletedWorkout, Workout, WorkoutProgram } from "@/lib/types";
import {
  createProgram,
  getNextProgramWorkout,
  getProgramState,
  removeWorkoutFromPrograms,
  setActiveProgram,
} from "@/lib/storage/program-storage";

beforeEach(() => localStorage.clear());

const workouts = ["push", "pull", "legs"].map(
  (id): Workout => ({ id, title: id, exercises: [] })
);
const program: WorkoutProgram = {
  id: "ppl",
  title: "PPL",
  workoutIds: workouts.map((workout) => workout.id),
};

describe("program storage", () => {
  it("creates a program and makes the first program active", () => {
    const created = createProgram("PPL", ["push", "pull", "push"]);
    expect(created?.workoutIds).toEqual(["push", "pull"]);
    expect(getProgramState().activeProgramId).toBe(created?.id);
  });

  it("rejects unknown active program ids", () => {
    createProgram("PPL", ["push"]);
    expect(setActiveProgram("missing")).toBe(false);
  });

  it("removes deleted workouts without deleting the program", () => {
    createProgram("PPL", ["push", "pull"]);
    removeWorkoutFromPrograms("push");
    expect(getProgramState().programs[0].workoutIds).toEqual(["pull"]);
  });
});

describe("next program workout", () => {
  it("starts at the first workout before any program history", () => {
    expect(getNextProgramWorkout(program, workouts, [])?.workout.id).toBe("push");
  });

  it("advances after the most recently completed program workout and cycles", () => {
    const history = [
      { workoutId: "push", date: "2026-07-20T10:00:00Z" },
      { workoutId: "pull", date: "2026-07-21T10:00:00Z" },
    ] as CompletedWorkout[];
    expect(getNextProgramWorkout(program, workouts, history)?.workout.id).toBe("legs");
    history.push({ workoutId: "legs", date: "2026-07-22T10:00:00Z" } as CompletedWorkout);
    expect(getNextProgramWorkout(program, workouts, history)?.workout.id).toBe("push");
  });

  it("ignores completions outside the program and missing workouts", () => {
    const history = [
      { workoutId: "other", date: "2026-07-23T10:00:00Z" },
    ] as CompletedWorkout[];
    expect(
      getNextProgramWorkout({ ...program, workoutIds: ["missing", "pull"] }, workouts, history)
        ?.workout.id
    ).toBe("pull");
  });
});
