"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  ArrowLeft,
  BookmarkPlus,
  CalendarDays,
  ChefHat,
  Copy,
  Plus,
  RotateCcw,
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
import { FoodPhotoAnalysisSheet } from "@/components/nutrition/FoodPhotoAnalysisSheet";
import { FoodPickerSheet } from "@/components/nutrition/FoodPickerSheet";
import { dayKeyToDate, toDayKey } from "@/lib/date/day-key";
import { nutrientsForQuantity, sumNutrients } from "@/lib/nutrition/calculations";
import type {
  NutritionEntry,
  NutritionMeal,
  NutritionSavedMeal,
  NutritionSavedMealItem,
} from "@/lib/nutrition/types";
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
  id: string;
  item: NutritionSavedMealItem;
  amount: string;
};

type RecipeSaveDestination = "saved_only" | NutritionMeal;

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
  startRecipe = false,
  entries,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayKey: string;
  initialMeal: NutritionMeal;
  initialSavedMealId?: string | null;
  startSaving?: boolean;
  startRecipe?: boolean;
  entries: NutritionEntry[];
  onSaved: () => void;
}) {
  const [destinationMeal, setDestinationMeal] = React.useState<NutritionMeal>(initialMeal);
  const [savedMeals, setSavedMeals] = React.useState<NutritionSavedMeal[]>([]);
  const [selectedSavedMeal, setSelectedSavedMeal] = React.useState<NutritionSavedMeal | null>(null);
  const [selectedItemAmounts, setSelectedItemAmounts] = React.useState<string[]>([]);
  const [multiplier, setMultiplier] = React.useState(1);
  const [recipePortions, setRecipePortions] = React.useState("1");
  const [savingCurrent, setSavingCurrent] = React.useState(false);
  const [savedMealName, setSavedMealName] = React.useState("");
  const [selectedCurrentEntryIds, setSelectedCurrentEntryIds] = React.useState<Set<string>>(
    new Set()
  );
  const [pendingDelete, setPendingDelete] = React.useState<NutritionSavedMeal | null>(null);
  const [pendingDayCopy, setPendingDayCopy] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState("meals");
  const [builderName, setBuilderName] = React.useState("");
  const [builderServings, setBuilderServings] = React.useState("2");
  const [recipeSaveDestination, setRecipeSaveDestination] =
    React.useState<RecipeSaveDestination>("saved_only");
  const [builderItems, setBuilderItems] = React.useState<MealBuilderItem[]>([]);
  const [ingredientPickerOpen, setIngredientPickerOpen] = React.useState(false);
  const [ingredientPhotoOpen, setIngredientPhotoOpen] = React.useState(false);

  const refreshSavedMeals = React.useCallback(() => {
    const meals = getNutritionSavedMeals();
    setSavedMeals(meals);
    return meals;
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setDestinationMeal(initialMeal);
    const loadedMeals = refreshSavedMeals();
    const initialSavedMeal = initialSavedMealId
      ? loadedMeals.find((meal) => meal.id === initialSavedMealId) ?? null
      : null;
    setSelectedSavedMeal(initialSavedMeal);
    setSelectedItemAmounts(
      initialSavedMeal?.items.map((item) =>
        item.quantity ? String(item.quantity.amount) : ""
      ) ?? []
    );
    setMultiplier(1);
    setRecipePortions("1");
    setTab(startRecipe ? "create" : "meals");
    setSavingCurrent(startSaving);
    setSavedMealName("");
    setSelectedCurrentEntryIds(
      new Set(
        entries
          .filter((entry) => entry.dayKey === dayKey && entry.meal === initialMeal)
          .map((entry) => entry.id)
      )
    );
    setBuilderName("");
    setBuilderServings("2");
    setRecipeSaveDestination("saved_only");
    setBuilderItems([]);
    setIngredientPickerOpen(false);
    setIngredientPhotoOpen(false);
  }, [
    dayKey,
    entries,
    initialMeal,
    initialSavedMealId,
    open,
    refreshSavedMeals,
    startSaving,
    startRecipe,
  ]);

  const builtMealItems = React.useMemo(
    () =>
      builderItems
        .map(({ item, amount }): NutritionSavedMealItem | null => {
          const parsedAmount = Number.parseFloat(amount);
          if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 100_000) {
            return null;
          }
          const snapshot = item.foodSnapshot;
          const originalAmount = item.quantity?.amount;
          const basisAmount = snapshot?.basisAmount ?? originalAmount;
          const basisUnit = snapshot?.basisUnit ?? item.quantity?.unit;
          const basisNutrients = snapshot?.nutrients ?? item.nutrients;
          if (!basisAmount || (basisUnit !== "g" && basisUnit !== "ml")) return null;
          return {
            ...item,
            quantity: { amount: parsedAmount, unit: basisUnit },
            nutrients: nutrientsForQuantity(
              basisNutrients,
              parsedAmount,
              basisAmount
            ),
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
  const parsedRecipePortions = Number.parseFloat(recipePortions);
  const effectiveMultiplier =
    selectedSavedMeal?.kind === "recipe" && selectedSavedMeal.servings
      ? Number.isFinite(parsedRecipePortions) && parsedRecipePortions > 0
        ? parsedRecipePortions / selectedSavedMeal.servings
        : 0
      : multiplier;

  const adjustedSelectedItems = React.useMemo(() => {
    if (!selectedSavedMeal) return null;
    const adjusted: NutritionSavedMealItem[] = [];
    for (const [index, item] of selectedSavedMeal.items.entries()) {
      if (!item.quantity) {
        adjusted.push(item);
        continue;
      }
      const amount = Number.parseFloat(selectedItemAmounts[index] ?? "");
      if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000) return null;
      const snapshot = item.foodSnapshot;
      const hasMatchingSnapshot = snapshot?.basisUnit === item.quantity.unit;
      adjusted.push({
        ...item,
        quantity: { ...item.quantity, amount },
        nutrients: nutrientsForQuantity(
          hasMatchingSnapshot ? snapshot.nutrients : item.nutrients,
          amount,
          hasMatchingSnapshot ? snapshot.basisAmount : item.quantity.amount
        ),
      });
    }
    return adjusted;
  }, [selectedItemAmounts, selectedSavedMeal]);

  const selectedAmountsChanged = Boolean(
    selectedSavedMeal?.items.some((item, index) => {
      if (!item.quantity) return false;
      const amount = Number.parseFloat(selectedItemAmounts[index] ?? "");
      return Number.isFinite(amount) && amount !== item.quantity.amount;
    })
  );

  const selectSavedMeal = (meal: NutritionSavedMeal) => {
    setSelectedSavedMeal(meal);
    setSelectedItemAmounts(
      meal.items.map((item) => (item.quantity ? String(item.quantity.amount) : ""))
    );
    setMultiplier(1);
    setRecipePortions("1");
  };

  const updateSelectedItemAmount = (index: number, amount: string) => {
    setSelectedItemAmounts((current) =>
      selectedSavedMeal?.items.map((item, itemIndex) =>
        itemIndex === index
          ? amount
          : current[itemIndex] ?? (item.quantity ? String(item.quantity.amount) : "")
      ) ?? current
    );
  };

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
    if (!adjustedSelectedItems) {
      toast.error("Every saved food quantity must be greater than zero.");
      return;
    }
    if (!Number.isFinite(effectiveMultiplier) || effectiveMultiplier <= 0) {
      toast.error("Enter how many recipe servings you ate.");
      return;
    }
    const result = copyNutritionItemsToDay(
      adjustedSelectedItems,
      dayKey,
      destinationMeal,
      effectiveMultiplier
    );
    reportCopy(result, selectedSavedMeal.name);
    if (result.saved && result.added > 0) onOpenChange(false);
  };

  const saveSelectedMealQuantityChanges = () => {
    if (!selectedSavedMeal || !adjustedSelectedItems) {
      toast.error("Every saved food quantity must be greater than zero.");
      return;
    }
    const updated = saveMealFromItems(
      selectedSavedMeal.name,
      adjustedSelectedItems,
      selectedSavedMeal.id,
      { kind: selectedSavedMeal.kind, servings: selectedSavedMeal.servings }
    );
    if (!updated) {
      toast.error("Couldn't update the saved meal quantities.");
      return;
    }
    setSelectedSavedMeal(updated);
    setSelectedItemAmounts(
      updated.items.map((item) => (item.quantity ? String(item.quantity.amount) : ""))
    );
    refreshSavedMeals();
    toast.success("Saved meal quantities updated");
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

  const addBuilderIngredient = (item: NutritionSavedMealItem) => {
    const amount = item.quantity?.amount;
    if (!amount || (item.quantity?.unit !== "g" && item.quantity?.unit !== "ml")) {
      toast.error("This ingredient needs a gram or millilitre amount.");
      return;
    }
    setBuilderItems((current) => [
      ...current,
      { id: crypto.randomUUID(), item, amount: String(amount) },
    ]);
  };

  const updateBuilderAmount = (id: string, amount: string) => {
    setBuilderItems((current) =>
      current.map((item) => (item.id === id ? { ...item, amount } : item))
    );
  };

  const removeBuilderFood = (id: string) => {
    setBuilderItems((current) => current.filter((item) => item.id !== id));
  };

  const saveBuiltMeal = () => {
    if (!builderName.trim()) {
      toast.error("Enter a recipe name.");
      return;
    }
    if (builderItems.length === 0) {
      toast.error("Add at least one ingredient to this recipe.");
      return;
    }
    if (builtMealItems.length !== builderItems.length) {
      toast.error("Every food needs an amount greater than zero.");
      return;
    }
    const servings = Number.parseFloat(builderServings);
    if (!Number.isFinite(servings) || servings <= 0 || servings > 1_000) {
      toast.error("Enter the total number of servings in the full recipe.");
      return;
    }
    const saved = saveMealFromItems(builderName, builtMealItems, undefined, {
      kind: "recipe",
      servings,
    });
    if (!saved) {
      toast.error("Use a unique meal name and check the food amounts.");
      return;
    }
    refreshSavedMeals();
    setBuilderName("");
    setBuilderItems([]);
    if (recipeSaveDestination === "saved_only") {
      onOpenChange(false);
      toast.success(`${saved.name} saved for later`);
      return;
    }
    const result = copyNutritionItemsToDay(
      saved.items,
      dayKey,
      recipeSaveDestination,
      1 / servings
    );
    if (!result.saved) {
      toast.error("Recipe saved, but its serving could not be added.");
      return;
    }
    if (result.added === 0) {
      setTab("meals");
      setSelectedSavedMeal(saved);
      toast.info("Recipe saved. That same serving is already logged in this meal.");
      return;
    }
    onSaved();
    onOpenChange(false);
    toast.success(
      `${saved.name} saved · 1 serving added to ${MEAL_LABELS[recipeSaveDestination].toLowerCase()}`
    );
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

  const selectedTotals = adjustedSelectedItems
    ? sumNutrients(adjustedSelectedItems)
    : null;
  const builderTotals = sumNutrients(builtMealItems);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="mx-auto h-[92dvh] max-w-xl overflow-hidden rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            if (ingredientPickerOpen || ingredientPhotoOpen) event.preventDefault();
          }}
        >
          {selectedSavedMeal ? (
            <>
              <SheetHeader className="text-left">
                <button type="button" className="mb-1 flex w-fit items-center gap-1 text-sm text-muted-foreground" onClick={() => setSelectedSavedMeal(null)}>
                  <ArrowLeft className="size-4" /> Saved meals
                </button>
                <SheetTitle>{selectedSavedMeal.name}</SheetTitle>
                <SheetDescription>
                  {selectedSavedMeal.items.length} ingredient{selectedSavedMeal.items.length === 1 ? "" : "s"} · {number(selectedTotals?.caloriesKcal ?? 0)} kcal for the full {selectedSavedMeal.kind === "recipe" ? "recipe" : "meal"}
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
                {selectedSavedMeal.kind === "recipe" && selectedSavedMeal.servings ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="recipe-portions">Servings eaten</Label>
                    <NumberInput
                      id="recipe-portions"
                      decimal
                      value={recipePortions}
                      onChange={(event) => setRecipePortions(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      The full recipe is divided into {number(selectedSavedMeal.servings)} servings. You can enter a decimal such as 1.5.
                    </p>
                  </div>
                ) : (
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
                )}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["Calories", `${number((selectedTotals?.caloriesKcal ?? 0) * effectiveMultiplier)} kcal`],
                    ["Protein", `${number((selectedTotals?.proteinG ?? 0) * effectiveMultiplier)} g`],
                    ["Carbs", `${number((selectedTotals?.carbsG ?? 0) * effectiveMultiplier)} g`],
                    ["Fat", `${number((selectedTotals?.fatG ?? 0) * effectiveMultiplier)} g`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold tabular-nums">{value}</p></div>
                  ))}
                </div>
                <section className="space-y-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {selectedSavedMeal.kind === "recipe" ? "Full-batch ingredient amounts" : "Saved food amounts"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Edits apply when you add this meal. Save them below to update the reusable meal too.
                    </p>
                  </div>
                  <ul className="divide-y rounded-xl border px-3">
                    {selectedSavedMeal.items.map((item, index) => {
                      const adjustedItem = adjustedSelectedItems?.[index] ?? item;
                      return (
                        <li key={`${item.name}-${index}`} className="space-y-2 py-3 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="min-w-0 truncate font-medium">{item.name}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {number(adjustedItem.nutrients.caloriesKcal * effectiveMultiplier)} kcal
                            </span>
                          </div>
                          {item.quantity ? (
                            <>
                              <div className="flex items-center gap-2">
                                <NumberInput
                                  decimal
                                  value={selectedItemAmounts[index] ?? ""}
                                  onChange={(event) => updateSelectedItemAmount(index, event.target.value)}
                                  aria-label={`${item.name} saved amount in ${item.quantity.unit}`}
                                  className="h-9"
                                />
                                <span className="w-14 shrink-0 text-sm text-muted-foreground">
                                  {item.quantity.unit}
                                </span>
                              </div>
                              {effectiveMultiplier !== 1 && (
                                <p className="text-xs text-muted-foreground">
                                  Adds {number((adjustedItem.quantity?.amount ?? 0) * effectiveMultiplier)} {item.quantity.unit} for the selected serving amount.
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground">Amount was not recorded for this item.</p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              </div>
              <SheetFooter className="gap-2">
                {selectedAmountsChanged && (
                  <Button type="button" variant="outline" onClick={saveSelectedMealQuantityChanges} disabled={!adjustedSelectedItems}>
                    Save quantity changes
                  </Button>
                )}
                <Button type="button" size="lg" onClick={useSavedMeal} disabled={effectiveMultiplier <= 0 || !adjustedSelectedItems}>
                  {selectedSavedMeal.kind === "recipe"
                    ? `Add ${recipePortions || ""} serving${parsedRecipePortions === 1 ? "" : "s"} to ${MEAL_LABELS[destinationMeal]}`
                    : `Add ${multiplier}× to ${MEAL_LABELS[destinationMeal]}`}
                </Button>
              </SheetFooter>
            </>
          ) : savingCurrent ? (
            <>
              <SheetHeader className="text-left">
                <button type="button" className="mb-1 flex w-fit items-center gap-1 text-sm text-muted-foreground" onClick={() => setSavingCurrent(false)}><ArrowLeft className="size-4" /> Add meal</button>
                <SheetTitle>Save {MEAL_LABELS[destinationMeal]}</SheetTitle>
                <SheetDescription>Choose exactly which foods belong in this reusable meal.</SheetDescription>
              </SheetHeader>
              <div className="flex-1 space-y-3 px-4">
                <div className="space-y-1.5"><Label htmlFor="saved-meal-name">Meal name</Label><Input id="saved-meal-name" value={savedMealName} onChange={(event) => setSavedMealName(event.target.value)} placeholder="e.g. Usual breakfast" maxLength={120} /></div>
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
                <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="meals">Saved</TabsTrigger><TabsTrigger value="create">Recipe</TabsTrigger><TabsTrigger value="days">Full day</TabsTrigger></TabsList>
                <TabsContent value="meals" className="min-h-0 space-y-4 overflow-y-auto pt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="repeat-destination">Meal</Label>
                    <Select value={destinationMeal} onValueChange={(value) => setDestinationMeal(value as NutritionMeal)}><SelectTrigger id="repeat-destination" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{(Object.entries(MEAL_LABELS) as [NutritionMeal, string][]).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
                  </div>

                  <Button type="button" variant="outline" className="w-full justify-start" disabled={!currentMealEntries.length} onClick={beginSavingCurrent}>
                    <BookmarkPlus className="size-4" /> Save current {MEAL_LABELS[destinationMeal].toLowerCase()}
                  </Button>
                  <Button type="button" variant="secondary" className="w-full justify-start" onClick={() => setTab("create")}>
                    <ChefHat className="size-4" /> Create a recipe
                  </Button>

                  <section className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Saved meals</p>
                    {savedMeals.length === 0 ? (
                      <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">No saved meals yet.</p>
                    ) : savedMeals.map((meal) => {
                      const totals = sumNutrients(meal.items);
                      return <div key={meal.id} className="flex items-center gap-2 rounded-xl border p-2"><button type="button" className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-left hover:bg-muted" onClick={() => selectSavedMeal(meal)}><span className="block truncate text-sm font-medium">{meal.name}</span><span className="block text-xs text-muted-foreground">{meal.kind === "recipe" && meal.servings ? `${number(meal.servings)} servings · ${meal.items.length} ingredients · ${number(totals.caloriesKcal)} kcal full batch` : `${meal.items.length} foods · ${number(totals.caloriesKcal)} kcal`}</span></button><Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" onClick={() => setPendingDelete(meal)} aria-label={`Delete ${meal.name}`}><Trash2 className="size-4" /></Button></div>;
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
                  <div className="rounded-xl border bg-muted/25 p-3">
                    <div className="flex items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><ChefHat className="size-4" /></span>
                      <div>
                        <p className="text-sm font-medium">Build the full cooked batch</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Add every ingredient you used and divide the full batch into servings. Saving it does not have to log anything today.</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1.5">
                      <Label htmlFor="builder-meal-name">Recipe name</Label>
                      <Input id="builder-meal-name" value={builderName} onChange={(event) => setBuilderName(event.target.value)} placeholder="e.g. Pasta bolognese" maxLength={120} />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label htmlFor="builder-servings">Servings in full batch</Label>
                      <NumberInput id="builder-servings" decimal value={builderServings} onChange={(event) => setBuilderServings(event.target.value)} />
                      <p className="text-xs text-muted-foreground">For a recipe shared by two people, enter 2. You can log 1.5 servings later if you ate more.</p>
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label htmlFor="builder-destination">After saving</Label>
                      <Select value={recipeSaveDestination} onValueChange={(value) => setRecipeSaveDestination(value as RecipeSaveDestination)}>
                        <SelectTrigger id="builder-destination" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="saved_only">Save recipe only</SelectItem>
                          {(Object.entries(MEAL_LABELS) as [NutritionMeal, string][]).map(([value, label]) => <SelectItem key={value} value={value}>Add 1 serving to {label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <section className="space-y-2">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ingredients</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {builderItems.length} selected · {number(builderTotals.caloriesKcal)} kcal
                        </p>
                      </div>
                    </div>
                    {builderItems.length === 0 ? (
                      <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                        Add ingredients using the same search, online sources, barcode scanner, or food photo tools.
                      </p>
                    ) : (
                      <ul className="divide-y rounded-xl border px-3">
                        {builderItems.map(({ id, item, amount }) => {
                          const parsedAmount = Number.parseFloat(amount);
                          const snapshot = item.foodSnapshot;
                          const basisAmount = snapshot?.basisAmount ?? item.quantity?.amount ?? 1;
                          const basisNutrients = snapshot?.nutrients ?? item.nutrients;
                          const unit = snapshot?.basisUnit ?? item.quantity?.unit ?? "g";
                          const nutrients = nutrientsForQuantity(basisNutrients, Number.isFinite(parsedAmount) ? parsedAmount : 0, basisAmount);
                          return (
                            <li key={id} className="space-y-2 py-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="min-w-0 truncate text-sm font-medium">
                                  {item.name}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="shrink-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeBuilderFood(id)}
                                  aria-label={`Remove ${item.name}`}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                              <div className="flex items-center gap-2">
                                <NumberInput
                                  decimal
                                  value={amount}
                                  onChange={(event) => updateBuilderAmount(id, event.target.value)}
                                  aria-label={`${item.name} amount in ${unit}`}
                                  className="h-9"
                                />
                                <span className="w-7 shrink-0 text-sm text-muted-foreground">{unit}</span>
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

                  <Button type="button" variant="outline" className="w-full" onClick={() => setIngredientPickerOpen(true)}>
                    <Plus className="size-4" /> Add ingredient
                  </Button>

                  <Button
                    type="button"
                    size="lg"
                    className="w-full"
                    disabled={!builderName.trim() || builderItems.length === 0}
                    onClick={saveBuiltMeal}
                  >
                    {recipeSaveDestination === "saved_only" ? "Save recipe" : "Save recipe & add 1 serving"}
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

          <FoodPickerSheet
            open={ingredientPickerOpen}
            onOpenChange={setIngredientPickerOpen}
            dayKey={dayKey}
            initialMeal={destinationMeal}
            entry={null}
            onSaved={() => undefined}
            mode="ingredient"
            onIngredientSelected={addBuilderIngredient}
            onPhotoScan={() => {
              setIngredientPickerOpen(false);
              window.setTimeout(() => setIngredientPhotoOpen(true), 150);
            }}
            onSavedMeal={() => undefined}
          />
          <FoodPhotoAnalysisSheet
            open={ingredientPhotoOpen}
            onOpenChange={setIngredientPhotoOpen}
            dayKey={dayKey}
            initialMeal={destinationMeal}
            onSaved={() => undefined}
            mode="ingredient"
            onIngredientsSelected={(items) => items.forEach(addBuilderIngredient)}
          />
        </SheetContent>
      </Sheet>

      <ConfirmDialog open={pendingDelete !== null} onOpenChange={(nextOpen) => !nextOpen && setPendingDelete(null)} title="Delete saved meal?" description={pendingDelete ? `${pendingDelete.name} will be removed. Logged foods will stay unchanged.` : undefined} confirmLabel="Delete meal" destructive onConfirm={confirmDelete} />
      <ConfirmDialog open={pendingDayCopy !== null} onOpenChange={(nextOpen) => !nextOpen && setPendingDayCopy(null)} title="Copy this entire day?" description={pendingDayCopy ? `Add every meal from ${format(dayKeyToDate(pendingDayCopy), "MMMM d")} to ${format(dayKeyToDate(dayKey), "MMMM d")}. Identical foods already present will be skipped.` : undefined} confirmLabel="Copy day" onConfirm={confirmFullDayCopy} />
    </>
  );
}
