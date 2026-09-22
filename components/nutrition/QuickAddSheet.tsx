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
import { nutrientsForQuantity } from "@/lib/nutrition/calculations";
import type {
  NutritionEntry,
  NutritionMeal,
  NutritionNutrients,
} from "@/lib/nutrition/types";
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

const number = (value: number) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value);

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
  const [weight, setWeight] = React.useState("");
  const [photoBasis, setPhotoBasis] = React.useState<NutritionNutrients | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const photoWeight =
      entry?.source === "meal_photo" && entry.quantity?.unit === "g"
        ? entry.quantity.amount
        : undefined;
    const basis =
      entry?.source === "meal_photo" && entry.foodSnapshot?.basisUnit === "g"
        ? nutrientsForQuantity(
            entry.foodSnapshot.nutrients,
            100,
            entry.foodSnapshot.basisAmount
          )
        : entry?.source === "meal_photo" && photoWeight
          ? nutrientsForQuantity(entry.nutrients, 100, photoWeight)
          : null;
    setMeal(entry?.meal ?? initialMeal);
    setName(entry?.name === "Quick add" ? "" : entry?.name ?? "");
    setCalories(entry ? String(entry.nutrients.caloriesKcal) : "");
    setProtein(entry?.nutrients.proteinG ? String(entry.nutrients.proteinG) : "");
    setCarbs(entry?.nutrients.carbsG ? String(entry.nutrients.carbsG) : "");
    setFat(entry?.nutrients.fatG ? String(entry.nutrients.fatG) : "");
    setWeight(photoWeight ? String(photoWeight) : "");
    setPhotoBasis(basis);
  }, [entry, initialMeal, open]);

  const updatePhotoWeight = (value: string) => {
    setWeight(value);
    const nextWeight = Number.parseFloat(value);
    if (
      entry?.source !== "meal_photo" ||
      !photoBasis ||
      !Number.isFinite(nextWeight) ||
      nextWeight <= 0
    ) return;
    const adjusted = nutrientsForQuantity(photoBasis, nextWeight, 100);
    setCalories(String(adjusted.caloriesKcal));
    setProtein(String(adjusted.proteinG));
    setCarbs(String(adjusted.carbsG));
    setFat(String(adjusted.fatG));
  };

  const updatePhotoNutrient = (
    field: "caloriesKcal" | "proteinG" | "carbsG" | "fatG",
    value: string,
    updateInput: React.Dispatch<React.SetStateAction<string>>
  ) => {
    updateInput(value);
    if (entry?.source !== "meal_photo") return;
    const currentWeight = Number.parseFloat(weight);
    const nextValue = Number.parseFloat(value);
    if (!Number.isFinite(currentWeight) || currentWeight <= 0 || !Number.isFinite(nextValue)) {
      return;
    }
    setPhotoBasis((current) =>
      current
        ? { ...current, [field]: (nextValue * 100) / currentWeight }
        : current
    );
  };

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
    const parsedWeight = weight.trim() ? Number.parseFloat(weight) : undefined;
    if (
      entry?.source === "meal_photo" &&
      (parsedWeight === undefined || !Number.isFinite(parsedWeight) || parsedWeight <= 0)
    ) {
      toast.error("Enter a weight greater than zero.");
      return;
    }
    const input = {
      dayKey,
      meal,
      name: name.trim() || "Quick add",
      source: entry?.source ?? ("quick_add" as const),
      nutrients: parsed,
      quantity:
        entry?.source === "meal_photo" && parsedWeight !== undefined
          ? { amount: parsedWeight, unit: "g" as const }
          : undefined,
      foodSnapshot:
        entry?.source === "meal_photo"
          ? {
              foodId: entry.foodSnapshot?.foodId,
              name: name.trim() || entry.name,
              basisAmount: 100,
              basisUnit: "g" as const,
              nutrients: nutrientsForQuantity(parsed, 100, parsedWeight),
              source: "meal_photo" as const,
            }
          : entry?.foodSnapshot,
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
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <SheetHeader className="text-left">
          <SheetTitle>
            {entry?.source === "meal_photo"
              ? "Edit photo estimate"
              : entry
                ? "Edit quick entry"
                : "Quick Add"}
          </SheetTitle>
          <SheetDescription>
            {format(dayKeyToDate(dayKey), "EEEE, MMMM d")} · {entry?.source === "meal_photo"
              ? "nutrition is adjusted from a 100 g basis."
              : "enter calories and any macros you know."}
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
          {entry?.source === "meal_photo" && (
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="quick-add-weight">Amount eaten (g)</Label>
              <NumberInput
                id="quick-add-weight"
                decimal
                value={weight}
                onChange={(event) => updatePhotoWeight(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The editable nutrition values below update automatically from the per-100g reference.
              </p>
            </div>
          )}
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
              onChange={(event) => updatePhotoNutrient("caloriesKcal", event.target.value, setCalories)}
              placeholder="Required"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quick-add-protein">Protein (g)</Label>
            <NumberInput
              id="quick-add-protein"
              decimal
              value={protein}
              onChange={(event) => updatePhotoNutrient("proteinG", event.target.value, setProtein)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quick-add-carbs">Carbs (g)</Label>
            <NumberInput
              id="quick-add-carbs"
              decimal
              value={carbs}
              onChange={(event) => updatePhotoNutrient("carbsG", event.target.value, setCarbs)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quick-add-fat">Fat (g)</Label>
            <NumberInput
              id="quick-add-fat"
              decimal
              value={fat}
              onChange={(event) => updatePhotoNutrient("fatG", event.target.value, setFat)}
              placeholder="Optional"
            />
          </div>
          {entry?.source === "meal_photo" && photoBasis && (
            <div className="col-span-2 rounded-xl border bg-muted/30 p-3 text-sm">
              <p className="font-medium">Per 100 g reference</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {number(photoBasis.caloriesKcal)} kcal · P {number(photoBasis.proteinG)}g · C {number(photoBasis.carbsG)}g · F {number(photoBasis.fatG)}g
              </p>
            </div>
          )}
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
