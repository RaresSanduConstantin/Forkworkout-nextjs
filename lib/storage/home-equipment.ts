// The equipment a user has at home, used to tailor the workout generator: which
// exercises are eligible and how heavy suggested loads can be. Persisted so the
// wizard can prefill it. Reads tolerate missing/corrupt data.

import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson } from "./safe-storage";

export type HomeEquipmentKey =
  | "dumbbells"
  | "kettlebells"
  | "bands"
  | "pullupBar"
  | "medicineBall"
  | "exerciseBall";

/** A home-equipment option: label, the library `equipment` values it unlocks,
 * and whether it carries a max weight (kg) that caps suggested loads. */
export type HomeEquipmentItem = {
  key: HomeEquipmentKey;
  label: string;
  lib: string[];
  weighted: boolean;
};

export const HOME_EQUIPMENT_ITEMS: HomeEquipmentItem[] = [
  { key: "dumbbells", label: "Dumbbells", lib: ["dumbbell", "e-z curl bar"], weighted: true },
  { key: "kettlebells", label: "Kettlebells", lib: ["kettlebells"], weighted: true },
  { key: "bands", label: "Resistance bands", lib: ["bands"], weighted: false },
  // A pull-up bar unlocks bar-requiring bodyweight moves (pull-ups, chin-ups,
  // hanging raises); it maps to no library equipment value of its own.
  { key: "pullupBar", label: "Pull-up bar", lib: [], weighted: false },
  { key: "medicineBall", label: "Medicine ball", lib: ["medicine ball"], weighted: false },
  { key: "exerciseBall", label: "Stability ball", lib: ["exercise ball"], weighted: false },
];

export const HOME_ITEM_BY_KEY: Map<HomeEquipmentKey, HomeEquipmentItem> = new Map(
  HOME_EQUIPMENT_ITEMS.map((i) => [i.key, i])
);

export type HomeEquipment = {
  /** Which items the user owns. */
  owned: HomeEquipmentKey[];
  /** Max load (kg) for the weighted items, if known. */
  dumbbellMaxKg?: number;
  kettlebellMaxKg?: number;
};

export const DEFAULT_HOME_EQUIPMENT: HomeEquipment = { owned: [] };

function posNum(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

function normalize(raw: unknown): HomeEquipment {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_HOME_EQUIPMENT };
  const r = raw as Record<string, unknown>;
  const validKeys = new Set(HOME_EQUIPMENT_ITEMS.map((i) => i.key));
  const owned = Array.isArray(r.owned)
    ? (r.owned.filter((k) => typeof k === "string" && validKeys.has(k as HomeEquipmentKey)) as HomeEquipmentKey[])
    : [];
  return {
    owned: [...new Set(owned)],
    dumbbellMaxKg: posNum(r.dumbbellMaxKg, 1, 100),
    kettlebellMaxKg: posNum(r.kettlebellMaxKg, 1, 100),
  };
}

export function getHomeEquipment(): HomeEquipment {
  return normalize(readJson<unknown>(STORAGE_KEYS.homeEquipment, null));
}

export function saveHomeEquipment(value: HomeEquipment): boolean {
  return writeJson(STORAGE_KEYS.homeEquipment, normalize(value));
}

/**
 * Resolve a home-equipment selection into the generator inputs: the set of
 * library `equipment` values allowed (body-only is always allowed separately),
 * and a per-equipment weight cap (kg) for weighted gear.
 */
export function resolveHomeEquipment(
  eq: HomeEquipment
): { allowed: string[]; maxKg: Record<string, number>; pullupBar: boolean } {
  const allowed: string[] = [];
  const maxKg: Record<string, number> = {};
  for (const key of eq.owned) {
    const item = HOME_ITEM_BY_KEY.get(key);
    if (!item) continue;
    allowed.push(...item.lib);
    if (item.weighted) {
      const cap = key === "dumbbells" ? eq.dumbbellMaxKg : eq.kettlebellMaxKg;
      if (cap != null) for (const lib of item.lib) maxKg[lib] = cap;
    }
  }
  return { allowed, maxKg, pullupBar: eq.owned.includes("pullupBar") };
}
