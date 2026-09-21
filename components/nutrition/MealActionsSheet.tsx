"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  ArrowLeft,
  BookmarkPlus,
  CalendarDays,
  Copy,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { sumNutrients } from "@/lib/nutrition/calculations";
import type {
  NutritionEntry,
  NutritionMeal,
  NutritionSavedMeal,
} from "@/lib/nutrition/types";
import {
  copyNutritionEntriesToDay,
  copyNutritionItemsToDay,
  deleteNutritionSavedMeal,
  getNutritionSavedMeals,
  saveMealFromEntries,
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
  startSaving = false,
  entries,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayKey: string;
  initialMeal: NutritionMeal;
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

  const refreshSavedMeals = React.useCallback(() => {
    setSavedMeals(getNutritionSavedMeals());
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setDestinationMeal(initialMeal);
    setSelectedSavedMeal(null);
    setMultiplier(1);
    setSavingCurrent(startSaving);
    setSavedMealName("");
    setSelectedCurrentEntryIds(
      new Set(
        entries
          .filter((entry) => entry.dayKey === dayKey && entry.meal === initialMeal)
          .map((entry) => entry.id)
      )
    );
    refreshSavedMeals();
  }, [dayKey, entries, initialMeal, open, refreshSavedMeals, startSaving]);

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
                      <span className="min-w-0 truncate">{item.name}</span>
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
                <SheetDescription>Add a saved or previous meal, or save the foods currently logged.</SheetDescription>
              </SheetHeader>
              <Tabs defaultValue="meals" className="min-h-0 flex-1 px-4 pb-4">
                <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="meals">Meals</TabsTrigger><TabsTrigger value="days">Full day</TabsTrigger></TabsList>
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
