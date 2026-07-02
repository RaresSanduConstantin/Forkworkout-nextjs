import type { BodyMeasurements, BodyMetricEntry } from "@/lib/types";
import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson } from "./safe-storage";
import { toDayKey } from "@/lib/date/day-key";
import { v4 as uuidv4 } from "uuid";

const MEASURE_KEYS: (keyof BodyMeasurements)[] = ["waist", "chest", "arms", "thighs", "hips"];

function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function normalize(raw: unknown): BodyMetricEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const date = typeof e.date === "string" ? e.date : null;
  if (!date) return null;

  let dayKey = typeof e.dayKey === "string" ? e.dayKey : undefined;
  if (!dayKey) {
    const parsed = new Date(date);
    dayKey = Number.isNaN(parsed.getTime()) ? undefined : toDayKey(parsed);
  }

  let measurements: BodyMeasurements | undefined;
  if (e.measurements && typeof e.measurements === "object") {
    const src = e.measurements as Record<string, unknown>;
    const m: BodyMeasurements = {};
    for (const k of MEASURE_KEYS) {
      const val = num(src[k]);
      if (val !== undefined) m[k] = val;
    }
    if (Object.keys(m).length > 0) measurements = m;
  }

  const weightKg = num(e.weightKg);
  // Skip entries with no useful data.
  if (weightKg === undefined && !measurements) return null;

  return {
    id: typeof e.id === "string" ? e.id : uuidv4(),
    date,
    dayKey,
    weightKg,
    measurements,
    note: typeof e.note === "string" && e.note.trim() ? e.note : undefined,
  };
}

/** All body-metric entries, oldest → newest, normalized. */
export function getBodyMetrics(): BodyMetricEntry[] {
  const raw = readJson<unknown[]>(STORAGE_KEYS.bodyMetrics, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalize)
    .filter((e): e is BodyMetricEntry => e !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/** Adds a body-metric entry (with a local day key). */
export function addBodyMetric(entry: {
  date?: string;
  weightKg?: number;
  measurements?: BodyMeasurements;
  note?: string;
}): boolean {
  const now = entry.date ? new Date(entry.date) : new Date();
  const normalized = normalize({
    id: uuidv4(),
    date: now.toISOString(),
    dayKey: toDayKey(now),
    weightKg: entry.weightKg,
    measurements: entry.measurements,
    note: entry.note,
  });
  if (!normalized) return false;
  const all = getBodyMetrics();
  all.push(normalized);
  return writeJson(STORAGE_KEYS.bodyMetrics, all);
}

/** Removes a body-metric entry by id. */
export function deleteBodyMetric(id: string): boolean {
  const all = getBodyMetrics().filter((e) => e.id !== id);
  return writeJson(STORAGE_KEYS.bodyMetrics, all);
}
