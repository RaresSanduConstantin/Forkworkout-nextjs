// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import type { Workout, WorkoutProgram } from "@/lib/types";
import { buildProgramShareUrl, decodeProgram } from "@/lib/storage/program-share";

describe("program sharing", () => {
  it("round-trips an ordered program with fresh workout ids", () => {
    const workouts: Workout[] = [
      {
        id: "push",
        title: "Push",
        exercises: [{ name: "Press", sets: [{ reps: 8, value: "20", unit: "kg" }] }],
      },
      {
        id: "pull",
        title: "Pull",
        exercises: [{ name: "Row", sets: [{ reps: 10, value: "25", unit: "kg" }] }],
      },
    ];
    const program: WorkoutProgram = {
      id: "ppl",
      title: "Push Pull",
      workoutIds: ["push", "pull"],
    };
    const url = buildProgramShareUrl(program, workouts, "https://forkworkout.test", "Try this");
    const encoded = url?.split("#importProgram=")[1] ?? "";
    const decoded = decodeProgram(encoded);

    expect(decoded?.program.title).toBe("Push Pull");
    expect(decoded?.workouts.map((workout) => workout.title)).toEqual(["Push", "Pull"]);
    expect(decoded?.program.workoutIds).toEqual(decoded?.workouts.map((workout) => workout.id));
    expect(decoded?.workouts[0].id).not.toBe("push");
    expect(decoded?.message).toBe("Try this");
  });

  it("rejects malformed program payloads", () => {
    expect(decodeProgram("broken")).toBeNull();
  });
});
