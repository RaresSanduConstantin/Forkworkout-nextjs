// Local day-key utilities for calendar grouping.
//
// Calendar comparisons must happen at day granularity in the user's LOCAL
// timezone. Comparing full ISO timestamps (which are UTC) can shift a workout
// onto the previous/next calendar day. Use a stable `YYYY-MM-DD` key instead.

/** Returns a stable local `YYYY-MM-DD` key for the given date (defaults to now). */
export function toDayKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parses a `YYYY-MM-DD` key into a local Date at midnight. */
export function dayKeyToDate(dayKey: string): Date {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/**
 * Returns the local `YYYY-MM-DD` keys for the current calendar week, starting on
 * Monday (ISO week). Used for "this week" counts so a workout from a previous
 * week never leaks in via a rolling 7-day window.
 */
export function currentWeekDayKeys(now: Date = new Date()): Set<string> {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // getDay(): 0=Sun..6=Sat. Days elapsed since Monday (Mon=0 … Sun=6).
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  const keys = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    keys.add(toDayKey(d));
  }
  return keys;
}
