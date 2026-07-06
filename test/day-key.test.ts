import { describe, it, expect } from "vitest";

import { currentWeekDayKeys, toDayKey } from "@/lib/date/day-key";

describe("currentWeekDayKeys", () => {
  it("returns Monday–Sunday of the week containing the given date", () => {
    // Monday 2026-07-06
    const keys = currentWeekDayKeys(new Date(2026, 6, 6, 15, 30));
    expect(keys.size).toBe(7);
    expect([...keys].sort()).toEqual([
      "2026-07-06", // Mon
      "2026-07-07",
      "2026-07-08",
      "2026-07-09",
      "2026-07-10",
      "2026-07-11",
      "2026-07-12", // Sun
    ]);
  });

  it("excludes a workout from the previous week (the reported bug)", () => {
    // Today = Monday 2026-07-06. A workout on Fri 2026-07-03 is LAST week.
    const week = currentWeekDayKeys(new Date(2026, 6, 6));
    expect(week.has("2026-07-03")).toBe(false); // Friday last week
    expect(week.has("2026-07-06")).toBe(true); // this Monday
  });

  it("treats Sunday as the last day of the same week (not a new week)", () => {
    // Sunday 2026-07-12 should still map to the Mon 07-06 … Sun 07-12 week.
    const week = currentWeekDayKeys(new Date(2026, 6, 12));
    expect(week.has("2026-07-06")).toBe(true);
    expect(week.has("2026-07-12")).toBe(true);
    expect(week.has("2026-07-13")).toBe(false); // next Monday
  });

  it("uses local day keys consistent with toDayKey", () => {
    const now = new Date(2026, 6, 8, 9, 0);
    expect(currentWeekDayKeys(now).has(toDayKey(now))).toBe(true);
  });
});
