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
