// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";

import { buildExport, mergeImport } from "@/lib/storage/transfer";
import { getHomeEquipment, saveHomeEquipment } from "@/lib/storage/home-equipment";

beforeEach(() => localStorage.clear());

describe("export/import — home equipment", () => {
  it("includes home equipment in the export bundle", () => {
    saveHomeEquipment({ owned: ["dumbbells"], dumbbellMaxKg: 8 });
    const bundle = buildExport();
    expect(bundle.homeEquipment?.owned).toEqual(["dumbbells"]);
    expect(bundle.homeEquipment?.dumbbellMaxKg).toBe(8);
  });

  it("restores home equipment on import when this device has none set", () => {
    const bundle = {
      version: 1,
      exportedAt: new Date().toISOString(),
      workouts: [],
      completedWorkouts: [],
      bodyMetrics: [],
      customExercises: [],
      homeEquipment: { owned: ["kettlebells"], kettlebellMaxKg: 12 },
    };
    const res = mergeImport(JSON.stringify(bundle));
    expect(res.homeEquipmentRestored).toBe(true);
    expect(getHomeEquipment().owned).toEqual(["kettlebells"]);
    expect(getHomeEquipment().kettlebellMaxKg).toBe(12);
  });

  it("does not overwrite home equipment already configured on this device", () => {
    saveHomeEquipment({ owned: ["dumbbells"], dumbbellMaxKg: 20 });
    const bundle = {
      version: 1,
      exportedAt: new Date().toISOString(),
      workouts: [],
      completedWorkouts: [],
      bodyMetrics: [],
      customExercises: [],
      homeEquipment: { owned: ["bands"] },
    };
    const res = mergeImport(JSON.stringify(bundle));
    expect(res.homeEquipmentRestored).toBe(false);
    expect(getHomeEquipment().owned).toEqual(["dumbbells"]);
  });
});
