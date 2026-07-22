// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { CURRENT_SCHEMA_VERSION, runMigrations } from "@/lib/storage/migrations";
import { STORAGE_KEYS } from "@/lib/storage/keys";
import { clearAllData } from "@/lib/storage/reset";
import { getSettings } from "@/lib/storage/settings";

beforeEach(() => localStorage.clear());

describe("clearAllData", () => {
  it("removes every user-owned value and restarts onboarding", () => {
    for (const key of Object.values(STORAGE_KEYS)) {
      localStorage.setItem(key, JSON.stringify({ saved: true }));
    }

    clearAllData();

    for (const key of Object.values(STORAGE_KEYS)) {
      if (key === STORAGE_KEYS.schemaVersion) continue;
      expect(localStorage.getItem(key), key).toBeNull();
    }
    expect(localStorage.getItem(STORAGE_KEYS.schemaVersion)).toBe(
      JSON.stringify(CURRENT_SCHEMA_VERSION)
    );
    expect(getSettings().onboardingDone).toBe(false);
  });

  it("can preserve custom exercises without preserving other user data", () => {
    localStorage.setItem(STORAGE_KEYS.customExercises, JSON.stringify([{ name: "My move" }]));
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({ onboardingDone: true }));
    localStorage.setItem(STORAGE_KEYS.autoBackup, JSON.stringify({ saved: true }));

    clearAllData({ keepCustomExercises: true });

    expect(localStorage.getItem(STORAGE_KEYS.customExercises)).not.toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.settings)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.autoBackup)).toBeNull();
    expect(getSettings().onboardingDone).toBe(false);
  });

  it("does not recreate an auto-backup on the next migration check", () => {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({ onboardingDone: true }));

    clearAllData();
    runMigrations();

    expect(localStorage.getItem(STORAGE_KEYS.autoBackup)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.schemaVersion)).toBe(
      JSON.stringify(CURRENT_SCHEMA_VERSION)
    );
  });
});
