import type { SetUnit } from "./types";

export const SET_UNITS: { value: SetUnit; label: string }[] = [
  { value: "kg", label: "Kg" },
  { value: "bw", label: "BW" },
  { value: "time", label: "Time" },
];

/**
 * Infers a set's unit from an existing unit or a legacy free-text value.
 * Legacy values looked like "60kg", "BW", "1min", or a bare number.
 */
export function inferUnit(value: string | undefined, existing?: string): SetUnit {
  if (existing === "kg" || existing === "bw" || existing === "time") return existing;
  const v = (value ?? "").trim().toLowerCase();
  if (!v) return "kg";
  if (v === "bw" || v.includes("bodyweight")) return "bw";
  if (/(min|sec|hour|:|\d\s*s\b|\d\s*h\b)/.test(v)) return "time";
  if (/(kg|lb)/.test(v)) return "kg";
  if (/^[\d.]+$/.test(v)) return "kg"; // bare number → weight
  return "time";
}

/**
 * Normalizes a raw value+unit pair into the canonical shape:
 * - kg:   value = numeric string only (e.g. "60")
 * - bw:   value = "BW"
 * - time: value = kept as-is
 */
export function normalizeUnitValue(
  rawValue: string | undefined,
  rawUnit?: string
): { unit: SetUnit; value: string } {
  const unit = inferUnit(rawValue, rawUnit);
  const raw = (rawValue ?? "").trim();
  if (unit === "kg") return { unit, value: raw.match(/[\d.]+/)?.[0] ?? "" };
  if (unit === "bw") return { unit, value: "BW" };
  return { unit, value: raw };
}

/** Weight in kg for a set, or 0 when it isn't a weighted (kg) set. */
export function setWeightKg(value: string, unit?: SetUnit): number {
  if (unit && unit !== "kg") return 0;
  const w = parseFloat(value);
  return Number.isFinite(w) ? w : 0;
}

/** Volume (kg) contributed by a set = reps × weight, only for kg sets. */
export function setVolumeKg(reps: number, value: string, unit?: SetUnit): number {
  const u = unit ?? inferUnit(value);
  if (u !== "kg") return 0;
  return reps * setWeightKg(value, u);
}

/** Human-readable load label for a set (e.g. "60 kg", "BW", "45s"). */
export function formatSetValue(value: string, unit?: SetUnit): string {
  const u = unit ?? inferUnit(value);
  if (u === "bw") return "BW";
  if (u === "kg") return value ? `${value} kg` : "—";
  return value || "—";
}

/** Placeholder text for the value input, by unit. */
export function unitPlaceholder(unit: SetUnit): string {
  if (unit === "kg") return "kg";
  if (unit === "time") return "e.g. 45s, 1min";
  return "";
}
