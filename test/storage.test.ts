// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";

import {
  getHomeEquipment,
  saveHomeEquipment,
  resolveHomeEquipment,
} from "@/lib/storage/home-equipment";
import { getBodyProfile, updateBodyProfile } from "@/lib/storage/profile";
import { getSettings, updateSettings, DEFAULT_SETTINGS } from "@/lib/storage/settings";

beforeEach(() => localStorage.clear());

describe("home equipment storage", () => {
  it("round-trips owned gear and max weights", () => {
    saveHomeEquipment({ owned: ["dumbbells", "bands"], dumbbellMaxKg: 8 });
    const he = getHomeEquipment();
    expect(he.owned).toEqual(expect.arrayContaining(["dumbbells", "bands"]));
    expect(he.dumbbellMaxKg).toBe(8);
  });

  it("drops unknown keys and out-of-range weights", () => {
    saveHomeEquipment({
      owned: ["dumbbells", "nope" as never],
      dumbbellMaxKg: 9999,
    });
    const he = getHomeEquipment();
    expect(he.owned).toEqual(["dumbbells"]);
    expect(he.dumbbellMaxKg).toBeUndefined();
  });

  it("resolves to allowed library equipment + per-equipment caps", () => {
    const r = resolveHomeEquipment({ owned: ["dumbbells", "bands"], dumbbellMaxKg: 10 });
    expect(r.allowed).toEqual(expect.arrayContaining(["dumbbell", "e-z curl bar", "bands"]));
    expect(r.maxKg["dumbbell"]).toBe(10);
    expect(r.maxKg["bands"]).toBeUndefined(); // bands aren't weighted
  });

  it("carries the pull-up bar flag through resolve + persistence", () => {
    expect(resolveHomeEquipment({ owned: ["pullupBar"] }).pullupBar).toBe(true);
    expect(resolveHomeEquipment({ owned: ["dumbbells"] }).pullupBar).toBe(false);
    saveHomeEquipment({ owned: ["pullupBar"] });
    expect(getHomeEquipment().owned).toContain("pullupBar");
  });
});

describe("body profile storage", () => {
  it("persists sex and normalizes an invalid value away", () => {
    updateBodyProfile({ sex: "female" });
    expect(getBodyProfile().sex).toBe("female");
    updateBodyProfile({ sex: "alien" as never });
    expect(getBodyProfile().sex).toBeUndefined();
  });

  it("keeps height within a sane range", () => {
    updateBodyProfile({ heightCm: 175 });
    expect(getBodyProfile().heightCm).toBe(175);
    updateBodyProfile({ heightCm: 5 });
    expect(getBodyProfile().heightCm).toBeUndefined();
  });
});

describe("settings storage", () => {
  it("returns defaults when empty", () => {
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("clamps the weekly goal to 1..7", () => {
    updateSettings({ weeklyGoal: 99 });
    expect(getSettings().weeklyGoal).toBe(7);
    updateSettings({ weeklyGoal: 0 });
    expect(getSettings().weeklyGoal).toBe(1);
  });
});
