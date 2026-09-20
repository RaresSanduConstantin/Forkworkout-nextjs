"use client";

import * as React from "react";
import { format, isToday } from "date-fns";
import {
  Apple,
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  Cookie,
  Flame,
  Moon,
  Pencil,
  Plus,
  Settings2,
  Sun,
  Trash2,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { QuickAddSheet } from "./QuickAddSheet";
import { FoodPickerSheet } from "./FoodPickerSheet";
import { MealActionsSheet } from "./MealActionsSheet";
import { NutritionTargetsDialog } from "./NutritionTargetsDialog";
import { dayKeyToDate, toDayKey } from "@/lib/date/day-key";
import {
  nutrientProgress,
  sumNutrients,
  workoutCaloriesForDay,
} from "@/lib/nutrition/calculations";
import {
  NUTRITION_MEALS,
  type NutritionEntry,
  type NutritionMeal,
  type NutritionTargets,
} from "@/lib/nutrition/types";
import { getCompletedWorkouts } from "@/lib/storage/history-storage";
import {
  deleteNutritionEntry,
  getNutritionDayAdjustments,
  getNutritionEntries,
  getNutritionTargets,
  setNutritionWorkoutCaloriesIncluded,
} from "@/lib/storage/nutrition-storage";

const MEAL_META: Record<
  NutritionMeal,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  breakfast: { label: "Breakfast", icon: Sun },
  lunch: { label: "Lunch", icon: Utensils },
  dinner: { label: "Dinner", icon: Moon },
  snacks: { label: "Snacks", icon: Cookie },
};

const number = (value: number) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value);

function defaultMeal(): NutritionMeal {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  if (hour < 21) return "dinner";
  return "snacks";
}

function MacroCard({
  label,
  consumed,
  target,
  indicatorClassName,
}: {
  label: string;
  consumed: number;
  target?: number;
  indicatorClassName: string;
}) {
  return (
    <Card className="py-0">
      <CardContent className="p-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 font-semibold tabular-nums">
          {number(consumed)}
          <span className="text-xs font-normal text-muted-foreground">
            {target ? ` / ${number(target)}g` : "g"}
          </span>
        </p>
        <Progress
          value={nutrientProgress(consumed, target)}
          className={`mt-2 h-1.5 ${indicatorClassName}`}
          aria-label={`${label}: ${number(consumed)} of ${target ? number(target) : "no target"} grams`}
        />
      </CardContent>
    </Card>
  );
}

export function NutritionDashboard() {
  const [dayKey, setDayKey] = React.useState(() => toDayKey());
  const [entries, setEntries] = React.useState<NutritionEntry[]>([]);
  const [targets, setTargets] = React.useState<NutritionTargets | null>(null);
  const [workoutAdjustmentDays, setWorkoutAdjustmentDays] = React.useState<string[]>([]);
  const [quickAddOpen, setQuickAddOpen] = React.useState(false);
  const [foodPickerOpen, setFoodPickerOpen] = React.useState(false);
  const [mealActionsOpen, setMealActionsOpen] = React.useState(false);
  const [mealActionStartSaving, setMealActionStartSaving] = React.useState(false);
  const [targetsOpen, setTargetsOpen] = React.useState(false);
  const [workoutAdjustmentOpen, setWorkoutAdjustmentOpen] = React.useState(false);
  const [quickMeal, setQuickMeal] = React.useState<NutritionMeal>(defaultMeal);
  const [editingEntry, setEditingEntry] = React.useState<NutritionEntry | null>(null);
  const [editingFoodEntry, setEditingFoodEntry] = React.useState<NutritionEntry | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<NutritionEntry | null>(null);

  const refresh = React.useCallback(() => {
    setEntries(getNutritionEntries());
    setTargets(getNutritionTargets());
    setWorkoutAdjustmentDays(
      getNutritionDayAdjustments().map((adjustment) => adjustment.dayKey)
    );
  }, []);

  React.useEffect(() => refresh(), [refresh]);

  const selectedDate = dayKeyToDate(dayKey);
  const dayEntries = React.useMemo(
    () => entries.filter((entry) => entry.dayKey === dayKey),
    [dayKey, entries]
  );
  const totals = React.useMemo(() => sumNutrients(dayEntries), [dayEntries]);
  const workoutCalories = React.useMemo(
    () => workoutCaloriesForDay(getCompletedWorkouts(), dayKey),
    [dayKey]
  );
  const workoutCaloriesIncluded = workoutAdjustmentDays.includes(dayKey);
  const netCalories = totals.caloriesKcal - workoutCalories;

  const moveDay = (delta: number) => {
    const next = dayKeyToDate(dayKey);
    next.setDate(next.getDate() + delta);
    setDayKey(toDayKey(next));
  };

  const openQuickAdd = (meal: NutritionMeal, entry: NutritionEntry | null = null) => {
    setQuickMeal(meal);
    setEditingEntry(entry);
    setQuickAddOpen(true);
  };

  const openFoodPicker = (meal: NutritionMeal, entry: NutritionEntry | null = null) => {
    setQuickMeal(meal);
    setEditingFoodEntry(entry);
    setFoodPickerOpen(true);
  };

  const openEntryEditor = (entry: NutritionEntry) => {
    if (entry.foodSnapshot && (entry.source === "builtin" || entry.source === "custom")) {
      openFoodPicker(entry.meal, entry);
    } else {
      openQuickAdd(entry.meal, entry);
    }
  };

  const openMealActions = (meal: NutritionMeal, startSaving = false) => {
    setQuickMeal(meal);
    setMealActionStartSaving(startSaving);
    setMealActionsOpen(true);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    if (!deleteNutritionEntry(pendingDelete.id)) {
      toast.error("Couldn't remove that entry.");
      return;
    }
    setPendingDelete(null);
    refresh();
    toast.success("Nutrition entry removed");
  };

  const calorieTarget = targets?.caloriesKcal;
  const effectiveCalorieTarget = calorieTarget
    ? calorieTarget + (workoutCaloriesIncluded ? workoutCalories : 0)
    : undefined;
  const remaining = effectiveCalorieTarget
    ? effectiveCalorieTarget - totals.caloriesKcal
    : null;
  const calorieTargetMet = Boolean(
    effectiveCalorieTarget && totals.caloriesKcal >= effectiveCalorieTarget
  );

  const confirmWorkoutAdjustment = () => {
    if (!calorieTarget) {
      setWorkoutAdjustmentOpen(false);
      setTargetsOpen(true);
      return;
    }
    const nextIncluded = !workoutCaloriesIncluded;
    if (!setNutritionWorkoutCaloriesIncluded(dayKey, nextIncluded)) {
      toast.error("Couldn't update today's calorie allowance.");
      return;
    }
    setWorkoutAdjustmentOpen(false);
    refresh();
    toast.success(
      nextIncluded
        ? `${number(workoutCalories)} workout kcal added to today's allowance`
        : "Today's base calorie target restored"
    );
  };

  return (
    <PageContainer className="pb-24">
      <PageHeader
        title="Nutrition"
        description="Simple daily calories and macros, stored only on this device."
        action={
          <Button type="button" variant="outline" onClick={() => setTargetsOpen(true)}>
            <Settings2 className="size-4" />
            Targets
          </Button>
        }
      />

      <div className="mb-4 flex items-center justify-between rounded-xl border bg-card p-2">
        <Button type="button" variant="ghost" size="icon" onClick={() => moveDay(-1)} aria-label="Previous day">
          <ChevronLeft className="size-5" />
        </Button>
        <button
          type="button"
          className="min-w-0 px-3 text-center"
          onClick={() => setDayKey(toDayKey())}
          aria-label="Return to today"
        >
          <p className="truncate text-sm font-semibold">
            {isToday(selectedDate) ? "Today" : format(selectedDate, "EEEE")}
          </p>
          <p className="text-xs text-muted-foreground">{format(selectedDate, "MMMM d, yyyy")}</p>
        </button>
        <Button type="button" variant="ghost" size="icon" onClick={() => moveDay(1)} aria-label="Next day">
          <ChevronRight className="size-5" />
        </Button>
      </div>

      <Card
        className={`relative overflow-hidden transition-colors duration-500 ${
          calorieTargetMet
            ? "border-emerald-400/50 bg-gradient-to-br from-emerald-500/15 via-background to-cyan-500/15 shadow-md shadow-emerald-500/10"
            : "border-primary/20 bg-gradient-to-br from-primary/10 via-background to-orange-500/10"
        }`}
      >
        {calorieTargetMet && (
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden"
            aria-hidden="true"
          >
            <span className="nutrition-goal-aurora absolute -left-16 -top-20 size-44 rounded-full bg-emerald-400/25 blur-3xl" />
            <span className="nutrition-goal-aurora nutrition-goal-aurora-delayed absolute -bottom-24 -right-12 size-48 rounded-full bg-cyan-400/25 blur-3xl" />
            <span className="nutrition-goal-sheen absolute -inset-y-12 left-0 w-20 bg-gradient-to-r from-transparent via-white/35 to-transparent blur-sm" />
          </div>
        )}
        <CardContent className="relative z-10 space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Calories</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">
                {number(totals.caloriesKcal)}
                {effectiveCalorieTarget ? (
                  <span className="text-base font-medium text-muted-foreground"> / {number(effectiveCalorieTarget)}</span>
                ) : null}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {remaining === null
                  ? "Set a target to track daily progress"
                  : remaining > 0
                    ? `${number(remaining)} kcal remaining`
                    : remaining === 0
                      ? "Daily calorie target reached"
                      : `Target reached · ${number(Math.abs(remaining))} kcal over`}
              </p>
            </div>
            <span
              className={`flex size-11 shrink-0 items-center justify-center rounded-full transition-all duration-500 ${
                calorieTargetMet
                  ? "nutrition-goal-icon bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 ring-4 ring-emerald-500/10"
                  : "bg-primary/15 text-primary"
              }`}
            >
              <Apple className={`size-5 ${calorieTargetMet ? "fill-current" : ""}`} />
            </span>
          </div>
          <Progress
            value={nutrientProgress(totals.caloriesKcal, effectiveCalorieTarget)}
            className="h-2.5"
            aria-label={`Calories: ${number(totals.caloriesKcal)} of ${effectiveCalorieTarget ? number(effectiveCalorieTarget) : "no target"}`}
          />
          {!targets && (
            <Button type="button" size="sm" onClick={() => setTargetsOpen(true)}>
              Set daily targets
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <MacroCard label="Protein" consumed={totals.proteinG} target={targets?.proteinG} indicatorClassName="[&_[data-slot=progress-indicator]]:bg-rose-500" />
        <MacroCard label="Carbs" consumed={totals.carbsG} target={targets?.carbsG} indicatorClassName="[&_[data-slot=progress-indicator]]:bg-amber-500" />
        <MacroCard label="Fat" consumed={totals.fatG} target={targets?.fatG} indicatorClassName="[&_[data-slot=progress-indicator]]:bg-sky-500" />
      </div>

      <button
        type="button"
        className="mt-3 flex w-full items-center gap-3 rounded-xl border bg-muted/25 p-3 text-left transition-colors enabled:hover:bg-muted/50 enabled:active:bg-muted disabled:cursor-default"
        onClick={() => setWorkoutAdjustmentOpen(true)}
        disabled={workoutCalories <= 0 && !workoutCaloriesIncluded}
        aria-label={
          workoutCaloriesIncluded
            ? "Remove workout calories from today's allowance"
            : workoutCalories > 0
              ? "Add workout calories to today's allowance"
              : undefined
        }
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
          <Flame className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Workout calories</p>
          <p className="text-xs text-muted-foreground">
            {workoutCaloriesIncluded
              ? `${number(workoutCalories)} kcal added to today's allowance · tap to undo`
              : workoutCalories > 0
                ? `${number(workoutCalories)} kcal recorded · ${number(netCalories)} kcal net · tap to adjust`
              : "No workout calories were recorded for this day."}
          </p>
        </div>
        {(workoutCalories > 0 || workoutCaloriesIncluded) && (
          <span className="flex shrink-0 items-center gap-1.5">
            <span
              className={`text-sm font-semibold tabular-nums ${
                workoutCaloriesIncluded ? "text-emerald-600 dark:text-emerald-400" : ""
              }`}
            >
              {workoutCaloriesIncluded ? "+" : "−"}{number(workoutCalories)}
            </span>
            <ChevronRight className="size-4 text-muted-foreground" />
          </span>
        )}
      </button>

      <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
        <Button
          type="button"
          size="lg"
          className="gap-2"
          onClick={() => openFoodPicker(defaultMeal())}
        >
          <Plus className="size-5" />
          Add Food
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="gap-2"
          onClick={() => openMealActions(defaultMeal())}
        >
          <Utensils className="size-4" />
          Add Meal
        </Button>
      </div>

      <div className="mt-5 space-y-3">
        {NUTRITION_MEALS.map((meal) => {
          const meta = MEAL_META[meal];
          const Icon = meta.icon;
          const mealEntries = dayEntries.filter((entry) => entry.meal === meal);
          const mealTotals = sumNutrients(mealEntries);
          return (
            <Card key={meal} className="gap-0 overflow-hidden py-0">
              {mealEntries.length === 0 ? (
                <button
                  type="button"
                  className="group flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-muted/50 active:bg-muted"
                  onClick={() => openFoodPicker(meal)}
                  aria-label={`Add food to ${meta.label}`}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-active:scale-95">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{meta.label}</span>
                    <span className="block text-xs text-muted-foreground">Nothing logged yet</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary">
                    Add
                    <span className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                      <Plus className="size-4" />
                    </span>
                  </span>
                </button>
              ) : (
                <>
                  <div className="flex items-center gap-3 p-4 pb-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base">{meta.label}</CardTitle>
                      <p className="text-xs text-muted-foreground">{number(mealTotals.caloriesKcal)} kcal</p>
                    </div>
                    <Button type="button" variant="outline" size="icon" className="size-10 shrink-0" onClick={() => openFoodPicker(meal)} aria-label={`Add food to ${meta.label}`}>
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  <CardContent className="px-4 pb-4">
                  <ul className="divide-y">
                    {mealEntries.map((entry) => (
                      <li key={entry.id} className="flex items-center gap-2 py-3 first:pt-0 last:pb-0">
                        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openEntryEditor(entry)}>
                          <p className="truncate text-sm font-medium">{entry.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            P {number(entry.nutrients.proteinG)}g · C {number(entry.nutrients.carbsG)}g · F {number(entry.nutrients.fatG)}g
                          </p>
                        </button>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">{number(entry.nutrients.caloriesKcal)} kcal</span>
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => openEntryEditor(entry)} aria-label={`Edit ${entry.name}`}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" onClick={() => setPendingDelete(entry)} aria-label={`Delete ${entry.name}`}>
                          <Trash2 className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 border-t pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => openMealActions(meal, true)}
                    >
                      <BookmarkPlus className="size-4" />
                      Save as meal
                    </Button>
                  </div>
                  </CardContent>
                </>
              )}
            </Card>
          );
        })}
      </div>

      <QuickAddSheet
        open={quickAddOpen}
        onOpenChange={(open) => {
          setQuickAddOpen(open);
          if (!open) setEditingEntry(null);
        }}
        dayKey={dayKey}
        initialMeal={quickMeal}
        entry={editingEntry}
        onSaved={refresh}
      />
      <FoodPickerSheet
        open={foodPickerOpen}
        onOpenChange={(open) => {
          setFoodPickerOpen(open);
          if (!open) setEditingFoodEntry(null);
        }}
        dayKey={dayKey}
        initialMeal={quickMeal}
        entry={editingFoodEntry}
        onSaved={refresh}
        onQuickAdd={(meal) => {
          setFoodPickerOpen(false);
          window.setTimeout(() => openQuickAdd(meal), 150);
        }}
        onSavedMeals={(meal) => {
          setFoodPickerOpen(false);
          window.setTimeout(() => openMealActions(meal), 150);
        }}
      />
      <MealActionsSheet
        open={mealActionsOpen}
        onOpenChange={(open) => {
          setMealActionsOpen(open);
          if (!open) setMealActionStartSaving(false);
        }}
        dayKey={dayKey}
        initialMeal={quickMeal}
        startSaving={mealActionStartSaving}
        entries={entries}
        onSaved={refresh}
      />
      <NutritionTargetsDialog
        open={targetsOpen}
        onOpenChange={setTargetsOpen}
        targets={targets}
        onSaved={setTargets}
      />
      <ConfirmDialog
        open={workoutAdjustmentOpen}
        onOpenChange={setWorkoutAdjustmentOpen}
        title={
          !calorieTarget
            ? "Set a calorie target first"
            : workoutCaloriesIncluded
              ? "Use your base calorie target?"
              : "Add workout calories to your allowance?"
        }
        description={
          !calorieTarget
            ? "Set a daily calorie target before adding workout calories to your food allowance."
            : workoutCaloriesIncluded
              ? `Remove the ${number(workoutCalories)} kcal adjustment for ${format(selectedDate, "MMMM d")}. Today's allowance will return to ${number(calorieTarget)} kcal.`
              : `Increase ${format(selectedDate, "MMMM d")}'s allowance from ${number(calorieTarget)} to ${number(calorieTarget + workoutCalories)} kcal. Workout calorie estimates can be imprecise, so this applies only to this day.`
        }
        confirmLabel={
          !calorieTarget
            ? "Set targets"
            : workoutCaloriesIncluded
              ? "Use base target"
              : `Add ${number(workoutCalories)} kcal`
        }
        onConfirm={confirmWorkoutAdjustment}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete nutrition entry?"
        description={pendingDelete ? `${pendingDelete.name} will be removed from this day.` : undefined}
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
      />
    </PageContainer>
  );
}
