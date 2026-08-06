import type { CompletedWorkout } from "./types";

export const RECENT_ACTIVITY_PAGE_SIZE = 10;

export type HistoryPage = {
  entries: CompletedWorkout[];
  page: number;
  totalPages: number;
  totalEntries: number;
  rangeStart: number;
  rangeEnd: number;
};

const completedAt = (entry: CompletedWorkout): number => {
  const time = Date.parse(entry.date);
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
};

/** Returns one bounded, newest-first page without mutating the input history. */
export function paginateHistory(
  history: CompletedWorkout[],
  requestedPage: number,
  pageSize = RECENT_ACTIVITY_PAGE_SIZE
): HistoryPage {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const sorted = [...history].sort((a, b) => completedAt(b) - completedAt(a));
  const totalEntries = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / safePageSize));
  const page = Math.min(totalPages, Math.max(1, Math.floor(requestedPage) || 1));
  const startIndex = (page - 1) * safePageSize;
  const entries = sorted.slice(startIndex, startIndex + safePageSize);

  return {
    entries,
    page,
    totalPages,
    totalEntries,
    rangeStart: totalEntries === 0 ? 0 : startIndex + 1,
    rangeEnd: startIndex + entries.length,
  };
}
