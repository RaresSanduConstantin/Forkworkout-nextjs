"use client";

import * as React from "react";
import { format } from "date-fns";
import { toast } from "sonner";

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
import { dayKeyToDate } from "@/lib/date/day-key";
import type { NutritionEntry, NutritionMeal } from "@/lib/nutrition/types";
import {
  addNutritionEntry,
  updateNutritionEntry,
} from "@/lib/storage/nutrition-storage";

const MEAL_LABELS: Record<NutritionMeal, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
};

export function QuickAddSheet({
  open,
  onOpenChange,
  dayKey,
  initialMeal,
  entry,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayKey: string;
  initialMeal: NutritionMeal;
  entry: NutritionEntry | null;
  onSaved: () => void;
}) {
  const [meal, setMeal] = React.useState<NutritionMeal>(initialMeal);
  const [name, setName] = React.useState("");
  const [calories, setCalories] = React.useState("");
  const [protein, setProtein] = React.useState("");
  const [carbs, setCarbs] = React.useState("");
  const [fat, setFat] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setMeal(entry?.meal ?? initialMeal);
    setName(entry?.name === "Quick add" ? "" : entry?.name ?? "");
    setCalories(entry ? String(entry.nutrients.caloriesKcal) : "");
    setProtein(entry?.nutrients.proteinG ? String(entry.nutrients.proteinG) : "");
    setCarbs(entry?.nutrients.carbsG ? String(entry.nutrients.carbsG) : "");
    setFat(entry?.nutrients.fatG ? String(entry.nutrients.fatG) : "");
  }, [entry, initialMeal, open]);

  const save = () => {
    const parsed = {
      caloriesKcal: Number.parseFloat(calories),
      proteinG: protein.trim() ? Number.parseFloat(protein) : 0,
      carbsG: carbs.trim() ? Number.parseFloat(carbs) : 0,
      fatG: fat.trim() ? Number.parseFloat(fat) : 0,
    };
    if (!Number.isFinite(parsed.caloriesKcal) || parsed.caloriesKcal <= 0) {
      toast.error("Enter calories greater than zero.");
      return;
    }
    if ([parsed.proteinG, parsed.carbsG, parsed.fatG].some((value) => !Number.isFinite(value) || value < 0)) {
      toast.error("Macros cannot be negative.");
      return;
    }
    const input = {
      dayKey,
      meal,
      name: name.trim() || "Quick add",
      source: "quick_add" as const,
      nutrients: parsed,
    };
    const saved = entry
      ? updateNutritionEntry(entry.id, input)
      : addNutritionEntry(input);
    if (!saved) {
      toast.error("Couldn't save this nutrition entry.");
      return;
    }
    onSaved();
    onOpenChange(false);
    toast.success(entry ? "Entry updated" : `Added to ${MEAL_LABELS[meal].toLowerCase()}`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[92dvh] max-w-xl overflow-y-auto rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader className="text-left">
          <SheetTitle>{entry ? "Edit quick entry" : "Quick Add"}</SheetTitle>
          <SheetDescription>
            {format(dayKeyToDate(dayKey), "EEEE, MMMM d")} · enter calories and any macros you
            know.
          </SheetDescription>
        </SheetHeader>

        <div className="grid grid-cols-2 gap-3 px-4">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="quick-add-meal">Meal</Label>
            <Select value={meal} onValueChange={(value) => setMeal(value as NutritionMeal)}>
              <SelectTrigger id="quick-add-meal" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(MEAL_LABELS) as [NutritionMeal, string][]).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="quick-add-name">Name (optional)</Label>
            <Input
              id="quick-add-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Restaurant meal"
              maxLength={160}
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="quick-add-calories">Calories (kcal)</Label>
            <NumberInput
              id="quick-add-calories"
              decimal
              value={calories}
              onChange={(event) => setCalories(event.target.value)}
              placeholder="Required"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quick-add-protein">Protein (g)</Label>
            <NumberInput
              id="quick-add-protein"
              decimal
              value={protein}
              onChange={(event) => setProtein(event.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quick-add-carbs">Carbs (g)</Label>
            <NumberInput
              id="quick-add-carbs"
              decimal
              value={carbs}
              onChange={(event) => setCarbs(event.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quick-add-fat">Fat (g)</Label>
            <NumberInput
              id="quick-add-fat"
              decimal
              value={fat}
              onChange={(event) => setFat(event.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <SheetFooter className="gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={save}>{entry ? "Save changes" : "Add food"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

