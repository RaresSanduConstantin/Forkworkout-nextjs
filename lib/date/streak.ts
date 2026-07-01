import { toDayKey } from "./day-key";

/**
 * Computes the current daily streak from a set of completed local day keys
 * (`YYYY-MM-DD`). The streak counts consecutive days ending today; if there is
 * no workout today but there was one yesterday, the streak still counts up to
 * yesterday (so it doesn't reset until a full day is missed).
 */
export function computeStreak(dayKeys: Iterable<string>): number {
  const days = new Set(dayKeys);
  if (days.size === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Start from today if worked out today, else yesterday.
  const cursor = new Date(today);
  if (!days.has(toDayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(toDayKey(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(toDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
