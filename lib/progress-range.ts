export type ProgressRange = "recent" | "all";

/** Applies the shared Progress-card session range to oldest-to-newest data. */
export function applyProgressRange<T>(
  items: T[],
  range: ProgressRange,
  recentLimit = 12
): T[] {
  return range === "all" ? [...items] : items.slice(-Math.max(1, recentLimit));
}
