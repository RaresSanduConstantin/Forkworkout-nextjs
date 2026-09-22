"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  ArrowLeft,
  BookmarkPlus,
  CalendarDays,
  Copy,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dayKeyToDate, toDayKey } from "@/lib/date/day-key";
import { nutrientsForQuantity, sumNutrients } from "@/lib/nutrition/calculations";
import {
  filterAndRankNutritionFoods,
  loadNutritionFoods,
} from "@/lib/nutrition/foods";
import type {
  NutritionEntry,
  NutritionFood,
  NutritionFoodPreference,
  NutritionMeal,
  NutritionSavedMeal,
  NutritionSavedMealItem,
} from "@/lib/nutrition/types";
import {
  getNutritionFoodPreferences,
  nutritionFoodKey,
} from "@/lib/storage/nutrition-food-storage";
import {
  copyNutritionEntriesToDay,
  copyNutritionItemsToDay,
  deleteNutritionSavedMeal,
  getNutritionSavedMeals,
  saveMealFromEntries,
  saveMealFromItems,
  type NutritionCopyResult,
} from "@/lib/storage/nutrition-meal-storage";

const MEAL_LABELS: Record<NutritionMeal, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
};

const MULTIPLIERS = [0.5, 1, 1.5, 2] as const;

const number = (value: number) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value);

type MealBuilderItem = {
  food: NutritionFood;
  amount: string;
};

function quantityLabel(
  item: NutritionSavedMealItem,
  multiplier = 1
): string {
  if (!item.quantity) return "Amount not recorded";
  return `${number(item.quantity.amount * multiplier)} ${item.quantity.unit}`;
}

function previousDayKey(dayKey: string): string {
  const date = dayKeyToDate(dayKey);
  date.setDate(date.getDate() - 1);
  return toDayKey(date);
}

export function MealActionsSheet({
  open,
  onOpenChange,
  dayKey,
  initialMeal,
  initialSavedMealId = null,
  startSaving = false,
  entries,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayKey: string;
  initialMeal: NutritionMeal;
  initialSavedMealId?: string | null;
  startSaving?: boolean;
  entries: NutritionEntry[];
  onSaved: () => void;
}) {
  const [destinationMeal, setDestinationMeal] = React.useState<NutritionMeal>(initialMeal);
  const [savedMeals, setSavedMeals] = React.useState<NutritionSavedMeal[]>([]);
  const [selectedSavedMeal, setSelectedSavedMeal] = React.useState<NutritionSavedMeal | null>(null);
  const [multiplier, setMultiplier] = React.useState<(typeof MULTIPLIERS)[number]>(1);
  const [savingCurrent, setSavingCurrent] = React.useState(false);
  const [savedMealName, setSavedMealName] = React.useState("");
  const [selectedCurrentEntryIds, setSelectedCurrentEntryIds] = React.useState<Set<string>>(
    new Set()
  );
  const [pendingDelete, setPendingDelete] = React.useState<NutritionSavedMeal | null>(null);
  const [pendingDayCopy, setPendingDayCopy] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState("meals");
  const [builderFoods, setBuilderFoods] = React.useState<NutritionFood[]>([]);
  const [builderPreferences, setBuilderPreferences] = React.useState<
    NutritionFoodPreference[]
  >([]);
  const [builderLoading, setBuilderLoading] = React.useState(false);
  const [builderQuery, setBuilderQuery] = React.useState("");
  const [builderName, setBuilderName] = React.useState("");
  const [builderItems, setBuilderItems] = React.useState<MealBuilderItem[]>([]);

  const refreshSavedMeals = React.useCallback(() => {
    const meals = getNutritionSavedMeals();
    setSavedMeals(meals);
    return meals;
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setDestinationMeal(initialMeal);
    const loadedMeals = refreshSavedMeals();
    setSelectedSavedMeal(
      initialSavedMealId
        ? loadedMeals.find((meal) => meal.id === initialSavedMealId) ?? null
        : null
    );
    setMultiplier(1);
    setTab("meals");
    setSavingCurrent(startSaving);
    setSavedMealName("");
    setSelectedCurrentEntryIds(
      new Set(
        entries
          .filter((entry) => entry.dayKey === dayKey && entry.meal === initialMeal)
          .map((entry) => entry.id)
      )
    );
    setBuilderQuery("");
    setBuilderName("");
    setBuilderItems([]);
    setBuilderLoading(true);
    void loadNutritionFoods().then((foods) => {
      setBuilderFoods(foods);
      setBuilderPreferences(getNutritionFoodPreferences());
      setBuilderLoading(false);
    });
  }, [
    dayKey,
    entries,
    initialMeal,
    initialSavedMealId,
    open,
    refreshSavedMeals,
    startSaving,
  ]);

  const visibleBuilderFoods = React.useMemo(
    () =>
      filterAndRankNutritionFoods(
        builderFoods,
        builderPreferences,
        builderQuery
      ).slice(0, builderQuery.trim() ? 30 : 12),
    [builderFoods, builderPreferences, builderQuery]
  );

  const builtMealItems = React.useMemo(
    () =>
      builderItems
        .map(({ food, amount }): NutritionSavedMealItem | null => {
          const parsedAmount = Number.parseFloat(amount);
          if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 100_000) {
            return null;
          }
          return {
            name: food.variant ? `${food.name} · ${food.variant}` : food.name,
            source: food.source,
            quantity: { amount: parsedAmount, unit: food.basisUnit },
            nutrients: nutrientsForQuantity(
              food.nutrients,
              parsedAmount,
              food.basisAmount
            ),
            foodSnapshot: {
              foodId: food.id,
              name: food.name,
              brand: food.brand,
              variant: food.variant,
              basisAmount: food.basisAmount,
              basisUnit: food.basisUnit,
              nutrients: food.nutrients,
              source: food.source,
              sourceReference: food.sourceReference,
            },
          };
        })
        .filter((item): item is NutritionSavedMealItem => item !== null),
    [builderItems]
  );

  const yesterdayKey = previousDayKey(dayKey);
  const currentMealEntries = entries.filter(
    (entry) => entry.dayKey === dayKey && entry.meal === destinationMeal
  );
  const priorDayKeys = Array.from(
    new Set(entries.filter((entry) => entry.dayKey < dayKey).map((entry) => entry.dayKey))
  ).sort((left, right) => right.localeCompare(left));
  const recentMealDays = priorDayKeys
    .filter((sourceDayKey) =>
      entries.some(
        (entry) => entry.dayKey === sourceDayKey && entry.meal === destinationMeal
      )
    )
    .slice(0, 6);
  const recentFullDays = priorDayKeys.slice(0, 8);

  const reportCopy = (result: NutritionCopyResult, label: string) => {
    if (!result.saved) {
      toast.error("Couldn't copy that nutrition data.");
      return;
    }
    onSaved();
    if (result.added === 0 && result.skipped > 0) {
      toast.info("Those foods are already logged for this day.");
      return;
    }
    const skipped = result.skipped > 0 ? ` · ${result.skipped} duplicate${result.skipped === 1 ? "" : "s"} skipped` : "";
    toast.success(`${label}: ${result.added} food${result.added === 1 ? "" : "s"} added${skipped}`);
  };

  const copyPreviousMeal = (sourceDayKey: string) => {
    const sourceEntries = entries.filter(
      (entry) => entry.dayKey === sourceDayKey && entry.meal === destinationMeal
    );
    const result = copyNutritionEntriesToDay(sourceEntries, dayKey, destinationMeal);
    reportCopy(result, MEAL_LABELS[destinationMeal]);
    if (result.saved && result.added > 0) onOpenChange(false);
  };

  const useSavedMeal = () => {
    if (!selectedSavedMeal) return;
    const result = copyNutritionItemsToDay(
      selectedSavedMeal.items,
      dayKey,
      destinationMeal,
      multiplier
    );
    reportCopy(result, selectedSavedMeal.name);
    if (result.saved && result.added > 0) onOpenChange(false);
  };

  const saveCurrentMeal = () => {
    if (!currentMealEntries.length) {
      toast.error(`Log something in ${MEAL_LABELS[destinationMeal].toLowerCase()} first.`);
      return;
    }
    const selectedEntries = currentMealEntries.filter((entry) =>
      selectedCurrentEntryIds.has(entry.id)
    );
    if (!selectedEntries.length) {
      toast.error("Choose at least one food to save.");
      return;
    }
    const saved = saveMealFromEntries(savedMealName, selectedEntries);
    if (!saved) {
      toast.error("Enter a unique meal name.");
      return;
    }
    refreshSavedMeals();
    setSavingCurrent(false);
    setSavedMealName("");
    toast.success("Meal saved for quick reuse");
  };

  const beginSavingCurrent = () => {
    setSelectedCurrentEntryIds(new Set(currentMealEntries.map((entry) => entry.id)));
    setSavingCurrent(true);
  };

  const toggleCurrentEntry = (id: string) => {
    setSelectedCurrentEntryIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addBuilderFood = (food: NutritionFood) => {
    const key = nutritionFoodKey(food);
    if (builderItems.some((item) => nutritionFoodKey(item.food) === key)) {
      toast.info(`${food.name} is already in this meal.`);
      return;
    }
    setBuilderItems((current) => [
      ...current,
      { food, amount: String(food.basisAmount) },
    ]);
  };

  const updateBuilderAmount = (key: string, amount: string) => {
    setBuilderItems((current) =>
      current.map((item) =>
        nutritionFoodKey(item.food) === key ? { ...item, amount } : item
      )
    );
  };

  const removeBuilderFood = (key: string) => {
    setBuilderItems((current) =>
      current.filter((item) => nutritionFoodKey(item.food) !== key)
    );
  };

  const saveBuiltMeal = () => {
    if (!builderName.trim()) {
      toast.error("Enter a meal name.");
      return;
    }
    if (builderItems.length === 0) {
      toast.error("Add at least one food to this meal.");
      return;
    }
    if (builtMealItems.length !== builderItems.length) {
      toast.error("Every food needs an amount greater than zero.");
      return;
    }
    const saved = saveMealFromItems(builderName, builtMealItems);
    if (!saved) {
      toast.error("Use a unique meal name and check the food amounts.");
      return;
    }
    refreshSavedMeals();
    setBuilderName("");
    setBuilderQuery("");
    setBuilderItems([]);
    setTab("meals");
    setSelectedSavedMeal(saved);
    toast.success("Meal saved and ready to add");
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    if (!deleteNutritionSavedMeal(pendingDelete.id)) {
      toast.error("Couldn't delete that saved meal.");
      return;
    }
    setPendingDelete(null);
    refreshSavedMeals();
    toast.success("Saved meal deleted");
  };

  const confirmFullDayCopy = () => {
    if (!pendingDayCopy) return;
    const sourceEntries = entries.filter((entry) => entry.dayKey === pendingDayCopy);
    const result = copyNutritionEntriesToDay(sourceEntries, dayKey);
    setPendingDayCopy(null);
    reportCopy(result, "Day copied");
    if (result.saved && result.added > 0) onOpenChange(false);
  };

  const selectedTotals = selectedSavedMeal
    ? sumNutrients(selectedSavedMeal.items)
    : null;
  const builderTotals = sumNutrients(builtMealItems);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="mx-auto h-[92dvh] max-w-xl overflow-hidden rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
        >
          {selectedSavedMeal ? (
            <>
              <SheetHeader className="text-left">
                <button type="button" className="mb-1 flex w-fit items-center gap-1 text-sm text-muted-foreground" onClick={() => setSelectedSavedMeal(null)}>
                  <ArrowLeft className="size-4" /> Saved meals
                </button>
                <SheetTitle>{selectedSavedMeal.name}</SheetTitle>
                <SheetDescription>
                  {selectedSavedMeal.items.length} food{selectedSavedMeal.items.length === 1 ? "" : "s"} · {number(selectedTotals?.caloriesKcal ?? 0)} kcal at 1×
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 space-y-5 overflow-y-auto px-4">
                <div className="space-y-1.5">
                  <Label htmlFor="saved-meal-destination">Add to</Label>
                  <Select value={destinationMeal} onValueChange={(value) => setDestinationMeal(value as NutritionMeal)}>
                    <SelectTrigger id="saved-meal-destination" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.entries(MEAL_LABELS) as [NutritionMeal, string][]).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Portion</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {MULTIPLIERS.map((value) => (
                      <Button key={value} type="button" variant={multiplier === value ? "default" : "outline"} onClick={() => setMultiplier(value)}>
                        {value}×
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["Calories", `${number((selectedTotals?.caloriesKcal ?? 0) * multiplier)} kcal`],
                    ["Protein", `${number((selectedTotals?.proteinG ?? 0) * multiplier)} g`],
                    ["Carbs", `${number((selectedTotals?.carbsG ?? 0) * multiplier)} g`],
                    ["Fat", `${number((selectedTotals?.fatG ?? 0) * multiplier)} g`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold tabular-nums">{value}</p></div>
                  ))}
                </div>
                <ul className="divide-y rounded-xl border px-3">
                  {selectedSavedMeal.items.map((item, index) => (
                    <li key={`${item.name}-${index}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate">{item.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {quantityLabel(item, multiplier)}
                        </span>
                      </span>
                      <span className="shrink-0 text-muted-foreground">{number(item.nutrients.caloriesKcal * multiplier)} kcal</span>
                    </li>
                  ))}
                </ul>
              </div>
              <SheetFooter><Button type="button" size="lg" onClick={useSavedMeal}>Add {multiplier}× to {MEAL_LABELS[destinationMeal]}</Button></SheetFooter>
            </>
          ) : savingCurrent ? (
            <>
              <SheetHeader className="text-left">
                <button type="button" className="mb-1 flex w-fit items-center gap-1 text-sm text-muted-foreground" onClick={() => setSavingCurrent(false)}><ArrowLeft className="size-4" /> Add meal</button>
                <SheetTitle>Save {MEAL_LABELS[destinationMeal]}</SheetTitle>
                <SheetDescription>Choose exactly which foods belong in this reusable meal.</SheetDescription>
              </SheetHeader>
              <div className="flex-1 space-y-3 px-4">
                <div className="space-y-1.5"><Label htmlFor="saved-meal-name">Meal name</Label><Input id="saved-meal-name" value={savedMealName} onChange={(event) => setSavedMealName(event.target.value)} placeholder="e.g. Usual breakfast" maxLength={120} autoFocus /></div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">{selectedCurrentEntryIds.size} of {currentMealEntries.length} selected</p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedCurrentEntryIds(new Set(currentMealEntries.map((entry) => entry.id)))}>Select all</Button>
                </div>
                <ul className="divide-y rounded-xl border px-3">
                  {currentMealEntries.map((entry) => (
                    <li key={entry.id}>
                      <label className="flex cursor-pointer items-center gap-3 py-3 text-sm">
                        <input type="checkbox" className="size-4 accent-primary" checked={selectedCurrentEntryIds.has(entry.id)} onChange={() => toggleCurrentEntry(entry.id)} />
                        <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                        <span className="shrink-0 text-muted-foreground">{number(entry.nutrients.caloriesKcal)} kcal</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
              <SheetFooter><Button type="button" size="lg" disabled={selectedCurrentEntryIds.size === 0} onClick={saveCurrentMeal}>Save {selectedCurrentEntryIds.size || ""} food{selectedCurrentEntryIds.size === 1 ? "" : "s"}</Button></SheetFooter>
            </>
          ) : (
            <>
              <SheetHeader className="text-left">
                <SheetTitle>Add Meal</SheetTitle>
                <SheetDescription>Reuse a meal, build one from foods, or copy a previous day.</SheetDescription>
              </SheetHeader>
              <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1 px-4 pb-4">
                <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="meals">Saved</TabsTrigger><TabsTrigger value="create">Create</TabsTrigger><TabsTrigger value="days">Full day</TabsTrigger></TabsList>
                <TabsContent value="meals" className="min-h-0 space-y-4 overflow-y-auto pt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="repeat-destination">Meal</Label>
                    <Select value={destinationMeal} onValueChange={(value) => setDestinationMeal(value as NutritionMeal)}><SelectTrigger id="repeat-destination" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{(Object.entries(MEAL_LABELS) as [NutritionMeal, string][]).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
                  </div>

                  <Button type="button" variant="outline" className="w-full justify-start" disabled={!currentMealEntries.length} onClick={beginSavingCurrent}>
                    <BookmarkPlus className="size-4" /> Save current {MEAL_LABELS[destinationMeal].toLowerCase()}
                  </Button>

                  <section className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Saved meals</p>
                    {savedMeals.length === 0 ? (
                      <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">No saved meals yet.</p>
                    ) : savedMeals.map((meal) => {
                      const totals = sumNutrients(meal.items);
                      return <div key={meal.id} className="flex items-center gap-2 rounded-xl border p-2"><button type="button" className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left hover:bg-muted" onClick={() => setSelectedSavedMeal(meal)}><span className="block truncate text-sm font-medium">{meal.name}</span><span className="block text-xs text-muted-foreground">{meal.items.length} foods · {number(totals.caloriesKcal)} kcal</span></button><Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" onClick={() => setPendingDelete(meal)} aria-label={`Delete ${meal.name}`}><Trash2 className="size-4" /></Button></div>;
                    })}
                  </section>

                  <section className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent {MEAL_LABELS[destinationMeal].toLowerCase()}</p>
                    {recentMealDays.length === 0 ? (
                      <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">No previous {MEAL_LABELS[destinationMeal].toLowerCase()} to copy.</p>
                    ) : recentMealDays.map((sourceDayKey) => {
                      const sourceEntries = entries.filter((entry) => entry.dayKey === sourceDayKey && entry.meal === destinationMeal);
                      const totals = sumNutrients(sourceEntries);
                      return <button key={sourceDayKey} type="button" className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition hover:bg-muted/50" onClick={() => copyPreviousMeal(sourceDayKey)}><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><RotateCcw className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{sourceDayKey === yesterdayKey ? "Yesterday" : format(dayKeyToDate(sourceDayKey), "EEE, MMM d")}</span><span className="block text-xs text-muted-foreground">{sourceEntries.length} foods · {number(totals.caloriesKcal)} kcal</span></span><Copy className="size-4 text-muted-foreground" /></button>;
                    })}
                  </section>
                </TabsContent>

                <TabsContent value="create" className="min-h-0 space-y-4 overflow-y-auto pt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="builder-meal-name">Meal name</Label>
                    <Input
                      id="builder-meal-name"
                      value={builderName}
                      onChange={(event) => setBuilderName(event.target.value)}
                      placeholder="e.g. Chicken rice bowl"
                      maxLength={120}
                    />
                  </div>

                  <section className="space-y-2">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Meal foods</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {builderItems.length} selected · {number(builderTotals.caloriesKcal)} kcal
                        </p>
                      </div>
                    </div>
                    {builderItems.length === 0 ? (
                      <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                        Search below and add foods to build this meal.
                      </p>
                    ) : (
                      <ul className="divide-y rounded-xl border px-3">
                        {builderItems.map(({ food, amount }) => {
                          const key = nutritionFoodKey(food);
                          const parsedAmount = Number.parseFloat(amount);
                          const nutrients = nutrientsForQuantity(
                            food.nutrients,
                            Number.isFinite(parsedAmount) ? parsedAmount : 0,
                            food.basisAmount
                          );
                          return (
                            <li key={key} className="space-y-2 py-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="min-w-0 truncate text-sm font-medium">
                                  {food.name}{food.variant ? ` · ${food.variant}` : ""}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="shrink-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeBuilderFood(key)}
                                  aria-label={`Remove ${food.name}`}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                              <div className="flex items-center gap-2">
                                <NumberInput
                                  decimal
                                  value={amount}
                                  onChange={(event) => updateBuilderAmount(key, event.target.value)}
                                  aria-label={`${food.name} amount in ${food.basisUnit}`}
                                  className="h-9"
                                />
                                <span className="w-7 shrink-0 text-sm text-muted-foreground">{food.basisUnit}</span>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                  {number(nutrients.caloriesKcal)} kcal
                                </span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>

                  <section className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add foods</p>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={builderQuery}
                        onChange={(event) => setBuilderQuery(event.target.value)}
                        placeholder="Search foods…"
                        className="pl-9"
                      />
                    </div>
                    <div className="rounded-xl border">
                      {builderLoading ? (
                        <div className="flex h-28 items-center justify-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="size-4 animate-spin" /> Loading foods…
                        </div>
                      ) : visibleBuilderFoods.length === 0 ? (
                        <p className="p-6 text-center text-sm text-muted-foreground">
                          No foods found. Create custom foods from Add Food first.
                        </p>
                      ) : (
                        <ul className="divide-y">
                          {visibleBuilderFoods.map((food) => {
                            const key = nutritionFoodKey(food);
                            const alreadyAdded = builderItems.some(
                              (item) => nutritionFoodKey(item.food) === key
                            );
                            return (
                              <li key={key}>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-muted/50 disabled:opacity-50"
                                  onClick={() => addBuilderFood(food)}
                                  disabled={alreadyAdded}
                                >
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium">{food.name}</span>
                                    <span className="block truncate text-xs text-muted-foreground">
                                      {food.variant ? `${food.variant} · ` : ""}{number(food.nutrients.caloriesKcal)} kcal / {food.basisAmount}{food.basisUnit}
                                    </span>
                                  </span>
                                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <Plus className="size-4" />
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </section>

                  <Button
                    type="button"
                    size="lg"
                    className="w-full"
                    disabled={!builderName.trim() || builderItems.length === 0}
                    onClick={saveBuiltMeal}
                  >
                    Save reusable meal
                  </Button>
                </TabsContent>

                <TabsContent value="days" className="min-h-0 space-y-3 overflow-y-auto pt-2">
                  <p className="text-sm text-muted-foreground">Copy all meals from a previous day. Foods already logged identically today will be skipped.</p>
                  {recentFullDays.length === 0 ? (
                    <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No previous nutrition days to copy.</p>
                  ) : recentFullDays.map((sourceDayKey) => {
                    const sourceEntries = entries.filter((entry) => entry.dayKey === sourceDayKey);
                    const totals = sumNutrients(sourceEntries);
                    return <button key={sourceDayKey} type="button" className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition hover:bg-muted/50" onClick={() => setPendingDayCopy(sourceDayKey)}><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarDays className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{sourceDayKey === yesterdayKey ? "Yesterday" : format(dayKeyToDate(sourceDayKey), "EEEE, MMM d")}</span><span className="block text-xs text-muted-foreground">{sourceEntries.length} foods · {number(totals.caloriesKcal)} kcal</span></span><Copy className="size-4 text-muted-foreground" /></button>;
                  })}
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog open={pendingDelete !== null} onOpenChange={(nextOpen) => !nextOpen && setPendingDelete(null)} title="Delete saved meal?" description={pendingDelete ? `${pendingDelete.name} will be removed. Logged foods will stay unchanged.` : undefined} confirmLabel="Delete meal" destructive onConfirm={confirmDelete} />
      <ConfirmDialog open={pendingDayCopy !== null} onOpenChange={(nextOpen) => !nextOpen && setPendingDayCopy(null)} title="Copy this entire day?" description={pendingDayCopy ? `Add every meal from ${format(dayKeyToDate(pendingDayCopy), "MMMM d")} to ${format(dayKeyToDate(dayKey), "MMMM d")}. Identical foods already present will be skipped.` : undefined} confirmLabel="Copy day" onConfirm={confirmFullDayCopy} />
    </>
  );
}
