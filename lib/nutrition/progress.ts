import { dayKeyToDate, toDayKey } from "@/lib/date/day-key";
import { sumNutrients } from "@/lib/nutrition/calculations";
import type {
  NutritionEntry,
  NutritionNutrients,
  NutritionTargets,
} from "@/lib/nutrition/types";

export type NutritionProgressSummary = {
  days: number;
  startDayKey: string;
  endDayKey: string;
  loggedDays: number;
  average: NutritionNutrients;
  calorieTargetDays: number;
  calorieRangeDays: number;
  proteinTargetDays: number;
  proteinReachedDays: number;
};

export function nutritionProgressSummary(
  entries: NutritionEntry[],
  endDayKey: string,
  days: number,
  targetsForDay: (dayKey: string) => NutritionTargets | null
): NutritionProgressSummary {
  const safeDays = Number.isInteger(days) && days > 0 && days <= 366 ? days : 7;
  const end = dayKeyToDate(endDayKey);
  const start = new Date(end);
  start.setDate(start.getDate() - safeDays + 1);
  const startDayKey = toDayKey(start);
  const byDay = new Map<string, NutritionEntry[]>();

  for (const entry of entries) {
    if (entry.dayKey < startDayKey || entry.dayKey > endDayKey) continue;
    const current = byDay.get(entry.dayKey) ?? [];
    current.push(entry);
    byDay.set(entry.dayKey, current);
  }

  let calorieTargetDays = 0;
  let calorieRangeDays = 0;
  let proteinTargetDays = 0;
  let proteinReachedDays = 0;
  const dailyTotals = Array.from(byDay.entries()).map(([dayKey, dayEntries]) => {
    const total = sumNutrients(dayEntries);
    const targets = targetsForDay(dayKey);
    if (targets?.caloriesKcal) {
      calorieTargetDays += 1;
      if (
        total.caloriesKcal >= targets.caloriesKcal * 0.9 &&
        total.caloriesKcal <= targets.caloriesKcal * 1.1
      ) {
        calorieRangeDays += 1;
      }
    }
    if (targets?.proteinG) {
      proteinTargetDays += 1;
      if (total.proteinG >= targets.proteinG) proteinReachedDays += 1;
    }
    return total;
  });

  const total = sumNutrients(dailyTotals);
  const divisor = dailyTotals.length || 1;
  const average = (value: number) => Math.round((value / divisor) * 10) / 10;

  return {
    days: safeDays,
    startDayKey,
    endDayKey,
    loggedDays: dailyTotals.length,
    average: {
      caloriesKcal: average(total.caloriesKcal),
      proteinG: average(total.proteinG),
      carbsG: average(total.carbsG),
      fatG: average(total.fatG),
      fibreG: total.fibreG === undefined ? undefined : average(total.fibreG),
      sugarG: total.sugarG === undefined ? undefined : average(total.sugarG),
      sodiumMg: total.sodiumMg === undefined ? undefined : average(total.sodiumMg),
    },
    calorieTargetDays,
    calorieRangeDays,
    proteinTargetDays,
    proteinReachedDays,
  };
}
