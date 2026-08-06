import { describe, expect, it } from "vitest";

import { applyProgressRange } from "@/lib/progress-range";

describe("progress chart ranges", () => {
  const sessions = Array.from({ length: 20 }, (_, index) => index + 1);

  it("shows the latest 12 sessions by default", () => {
    expect(applyProgressRange(sessions, "recent")).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 9)
    );
  });

  it("shows every session for all time", () => {
    expect(applyProgressRange(sessions, "all")).toEqual(sessions);
    expect(applyProgressRange(sessions, "all")).not.toBe(sessions);
  });

  it("does not mutate the source data", () => {
    const source = [1, 2, 3];
    expect(applyProgressRange(source, "recent", 2)).toEqual([2, 3]);
    expect(source).toEqual([1, 2, 3]);
  });
});
