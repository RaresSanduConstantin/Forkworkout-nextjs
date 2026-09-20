"use client";

import * as React from "react";
import {
  ArrowLeft,
  Loader2,
  Pencil,
  Plus,
  Search,
  Star,
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
import { nutrientsForQuantity } from "@/lib/nutrition/calculations";
import {
  filterAndRankNutritionFoods,
  loadNutritionFoods,
  refreshNutritionFoods,
} from "@/lib/nutrition/foods";
import type {
  NutritionFood,
  NutritionFoodPreference,
  NutritionEntry,
  NutritionMeal,
} from "@/lib/nutrition/types";
import {
  deleteCustomNutritionFood,
  getNutritionFoodPreferences,
  nutritionFoodKey,
  recordNutritionFoodUse,
  setNutritionFoodFavourite,
  upsertCustomNutritionFood,
} from "@/lib/storage/nutrition-food-storage";
import { addNutritionEntry, updateNutritionEntry } from "@/lib/storage/nutrition-storage";

const MEAL_LABELS: Record<NutritionMeal, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
};

const number = (value: number) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value);

type View = "browse" | "quantity" | "custom";

const EMPTY_CUSTOM_FORM = {
  name: "",
  aliases: "",
  variant: "",
  basisUnit: "g" as "g" | "ml",
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
};

export function FoodPickerSheet({
  open,
  onOpenChange,
  dayKey,
  initialMeal,
  entry,
  onSaved,
  onQuickAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayKey: string;
  initialMeal: NutritionMeal;
  entry?: NutritionEntry | null;
  onSaved: () => void;
  onQuickAdd: (meal: NutritionMeal) => void;
}) {
  const [view, setView] = React.useState<View>("browse");
  const [meal, setMeal] = React.useState<NutritionMeal>(initialMeal);
  const [foods, setFoods] = React.useState<NutritionFood[]>([]);
  const [preferences, setPreferences] = React.useState<NutritionFoodPreference[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [selectedFood, setSelectedFood] = React.useState<NutritionFood | null>(null);
  const [quantity, setQuantity] = React.useState("100");
  const [editingCustom, setEditingCustom] = React.useState<NutritionFood | null>(null);
  const [customForm, setCustomForm] = React.useState(EMPTY_CUSTOM_FORM);
  const [pendingDelete, setPendingDelete] = React.useState<NutritionFood | null>(null);

  const reloadFoods = React.useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    const nextFoods = initial ? await loadNutritionFoods() : await refreshNutritionFoods();
    setFoods(nextFoods);
    setPreferences(getNutritionFoodPreferences());
    setLoading(false);
    return nextFoods;
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setView("browse");
    setMeal(entry?.meal ?? initialMeal);
    setQuery("");
    setSelectedFood(null);
    void reloadFoods(true).then((loadedFoods) => {
      if (
        !entry?.foodSnapshot ||
        (entry.source !== "builtin" && entry.source !== "custom")
      ) return;
      const food =
        loadedFoods.find(
          (candidate) =>
            candidate.source === entry.source &&
            candidate.id === entry.foodSnapshot?.foodId
        ) ?? {
          id: entry.foodSnapshot.foodId ?? entry.id,
          name: entry.foodSnapshot.name,
          aliases: [],
          variant: entry.foodSnapshot.variant,
          basisAmount: entry.foodSnapshot.basisAmount,
          basisUnit: entry.foodSnapshot.basisUnit,
          nutrients: entry.foodSnapshot.nutrients,
          source: entry.source,
          sourceReference: entry.foodSnapshot.sourceReference,
        };
      setSelectedFood(food);
      setQuantity(String(entry.quantity?.amount ?? food.basisAmount));
      setView("quantity");
    });
  }, [entry, initialMeal, open, reloadFoods]);

  const rankedFoods = React.useMemo(
    () => filterAndRankNutritionFoods(foods, preferences, query),
    [foods, preferences, query]
  );
  const hasPersonalFoods = preferences.some(
    (preference) => preference.favourite || preference.useCount > 0
  );
  const visibleFoods = query.trim()
    ? rankedFoods.slice(0, 40)
    : hasPersonalFoods
      ? rankedFoods
          .filter((food) => {
            const preference = preferences.find(
              (item) => item.foodKey === nutritionFoodKey(food)
            );
            return preference?.favourite || preference?.useCount;
          })
          .slice(0, 16)
      : rankedFoods.slice(0, 12);

  const selectFood = (food: NutritionFood) => {
    setSelectedFood(food);
    setQuantity(String(food.basisAmount));
    setView("quantity");
  };

  const toggleFavourite = (food: NutritionFood) => {
    const key = nutritionFoodKey(food);
    const current = preferences.find((preference) => preference.foodKey === key);
    if (!setNutritionFoodFavourite(key, !current?.favourite)) {
      toast.error("Couldn't update favourites.");
      return;
    }
    setPreferences(getNutritionFoodPreferences());
  };

  const parsedQuantity = Number.parseFloat(quantity);
  const calculated = selectedFood
    ? nutrientsForQuantity(
        selectedFood.nutrients,
        Number.isFinite(parsedQuantity) ? parsedQuantity : 0,
        selectedFood.basisAmount
      )
    : null;

  const saveSelectedFood = () => {
    if (!selectedFood || !Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      toast.error("Enter an amount greater than zero.");
      return;
    }
    if (parsedQuantity > 100_000) {
      toast.error("That amount is too large.");
      return;
    }
    const nutrients = nutrientsForQuantity(
      selectedFood.nutrients,
      parsedQuantity,
      selectedFood.basisAmount
    );
    const input = {
      dayKey,
      meal,
      name: selectedFood.variant
        ? `${selectedFood.name} · ${selectedFood.variant}`
        : selectedFood.name,
      source: selectedFood.source,
      quantity: { amount: parsedQuantity, unit: selectedFood.basisUnit },
      nutrients,
      foodSnapshot: {
        foodId: selectedFood.id,
        name: selectedFood.name,
        variant: selectedFood.variant,
        basisAmount: selectedFood.basisAmount,
        basisUnit: selectedFood.basisUnit,
        nutrients: selectedFood.nutrients,
        source: selectedFood.source,
        sourceReference: selectedFood.sourceReference,
      },
    };
    const saved = entry
      ? updateNutritionEntry(entry.id, input)
      : addNutritionEntry(input);
    if (!saved) {
      toast.error("Couldn't add that food.");
      return;
    }
    if (!entry) recordNutritionFoodUse(nutritionFoodKey(selectedFood));
    onSaved();
    onOpenChange(false);
    toast.success(entry ? "Food entry updated" : `Added to ${MEAL_LABELS[meal].toLowerCase()}`);
  };

  const openCustomForm = (food?: NutritionFood) => {
    setEditingCustom(food ?? null);
    setCustomForm(
      food
        ? {
            name: food.name,
            aliases: food.aliases.join(", "),
            variant: food.variant ?? "",
            basisUnit: food.basisUnit,
            calories: String(food.nutrients.caloriesKcal),
            protein: String(food.nutrients.proteinG),
            carbs: String(food.nutrients.carbsG),
            fat: String(food.nutrients.fatG),
          }
        : EMPTY_CUSTOM_FORM
    );
    setView("custom");
  };

  const saveCustomFood = async () => {
    const nutrients = {
      caloriesKcal: Number.parseFloat(customForm.calories),
      proteinG: Number.parseFloat(customForm.protein),
      carbsG: Number.parseFloat(customForm.carbs),
      fatG: Number.parseFloat(customForm.fat),
    };
    if (!customForm.name.trim()) {
      toast.error("Enter a food name.");
      return;
    }
    if (
      !Number.isFinite(nutrients.caloriesKcal) ||
      nutrients.caloriesKcal < 0 ||
      [nutrients.proteinG, nutrients.carbsG, nutrients.fatG].some(
        (value) => !Number.isFinite(value) || value < 0
      )
    ) {
      toast.error("Enter valid nutrition values of zero or more.");
      return;
    }
    const saved = upsertCustomNutritionFood(
      {
        name: customForm.name.trim(),
        aliases: customForm.aliases
          .split(",")
          .map((alias) => alias.trim())
          .filter(Boolean),
        variant: customForm.variant.trim() || undefined,
        basisAmount: 100,
        basisUnit: customForm.basisUnit,
        nutrients,
        sourceReference: undefined,
      },
      editingCustom?.id
    );
    if (!saved) {
      toast.error("Couldn't save that food. Check for a duplicate name and variant.");
      return;
    }
    await reloadFoods();
    setSelectedFood(saved);
    setQuantity("100");
    setView("quantity");
    toast.success(editingCustom ? "Custom food updated" : "Custom food created");
  };

  const confirmDeleteCustom = async () => {
    if (!pendingDelete) return;
    if (!deleteCustomNutritionFood(pendingDelete.id)) {
      toast.error("Couldn't delete that custom food.");
      return;
    }
    setPendingDelete(null);
    await reloadFoods();
    toast.success("Custom food deleted");
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="mx-auto h-[92dvh] max-w-xl overflow-hidden rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          {view === "browse" && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle>Add Food</SheetTitle>
                <SheetDescription>Search the offline catalog or use a recent favourite.</SheetDescription>
              </SheetHeader>
              <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="pl-9"
                    placeholder="Chicken, rice, ouă, cartofi…"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" onClick={() => onQuickAdd(meal)}>
                    <Plus className="size-4" /> Quick Add
                  </Button>
                  <Button type="button" variant="outline" onClick={() => openCustomForm()}>
                    <Plus className="size-4" /> Custom food
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {query.trim() ? "Search results" : hasPersonalFoods ? "Recent & favourites" : "Popular foods"}
                  </p>
                  {!loading && <span className="text-xs text-muted-foreground">{visibleFoods.length} shown</span>}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border">
                  {loading ? (
                    <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" /> Loading foods…
                    </div>
                  ) : visibleFoods.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      No foods found. Try another name or create a custom food.
                    </div>
                  ) : (
                    <ul className="divide-y">
                      {visibleFoods.map((food) => {
                        const key = nutritionFoodKey(food);
                        const preference = preferences.find((item) => item.foodKey === key);
                        return (
                          <li key={key} className="flex items-center gap-1 p-2">
                            <button
                              type="button"
                              className="min-w-0 flex-1 rounded-lg px-2 py-2 text-left transition hover:bg-muted"
                              onClick={() => selectFood(food)}
                            >
                              <span className="block truncate text-sm font-medium">{food.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {food.variant ? `${food.variant} · ` : ""}{number(food.nutrients.caloriesKcal)} kcal / {food.basisAmount}{food.basisUnit}
                              </span>
                            </button>
                            {food.source === "custom" && (
                              <>
                                <Button type="button" variant="ghost" size="icon-sm" onClick={() => openCustomForm(food)} aria-label={`Edit ${food.name}`}>
                                  <Pencil className="size-4" />
                                </Button>
                                <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" onClick={() => setPendingDelete(food)} aria-label={`Delete ${food.name}`}>
                                  <Trash2 className="size-4" />
                                </Button>
                              </>
                            )}
                            <Button type="button" variant="ghost" size="icon-sm" onClick={() => toggleFavourite(food)} aria-label={preference?.favourite ? `Remove ${food.name} from favourites` : `Add ${food.name} to favourites`}>
                              <Star className={`size-4 ${preference?.favourite ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`} />
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <p className="text-center text-[11px] text-muted-foreground">Bundled values are sourced from USDA FoodData Central and work offline.</p>
              </div>
            </>
          )}

          {view === "quantity" && selectedFood && calculated && (
            <>
              <SheetHeader className="text-left">
                <button type="button" className="mb-1 flex w-fit items-center gap-1 text-sm text-muted-foreground" onClick={() => setView("browse")}>
                  <ArrowLeft className="size-4" /> Back to search
                </button>
                <SheetTitle>{entry ? `Edit ${selectedFood.name}` : selectedFood.name}</SheetTitle>
                <SheetDescription>{selectedFood.variant ?? "Per 100" + selectedFood.basisUnit}</SheetDescription>
              </SheetHeader>
              <div className="grid grid-cols-2 gap-3 overflow-y-auto px-4">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="food-meal">Meal</Label>
                  <Select value={meal} onValueChange={(value) => setMeal(value as NutritionMeal)}>
                    <SelectTrigger id="food-meal" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.entries(MEAL_LABELS) as [NutritionMeal, string][]).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="food-quantity">Amount ({selectedFood.basisUnit})</Label>
                  <NumberInput id="food-quantity" decimal value={quantity} onChange={(event) => setQuantity(event.target.value)} autoFocus />
                  <p className="text-xs text-muted-foreground">Values are calculated from {selectedFood.basisAmount}{selectedFood.basisUnit}.</p>
                </div>
                {[
                  ["Calories", `${number(calculated.caloriesKcal)} kcal`],
                  ["Protein", `${number(calculated.proteinG)} g`],
                  ["Carbs", `${number(calculated.carbsG)} g`],
                  ["Fat", `${number(calculated.fatG)} g`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 font-semibold tabular-nums">{value}</p>
                  </div>
                ))}
              </div>
              <SheetFooter>
                <Button type="button" size="lg" onClick={saveSelectedFood}>{entry ? "Save changes" : `Add to ${MEAL_LABELS[meal]}`}</Button>
              </SheetFooter>
            </>
          )}

          {view === "custom" && (
            <>
              <SheetHeader className="text-left">
                <button type="button" className="mb-1 flex w-fit items-center gap-1 text-sm text-muted-foreground" onClick={() => setView("browse")}>
                  <ArrowLeft className="size-4" /> Back to search
                </button>
                <SheetTitle>{editingCustom ? "Edit custom food" : "Create custom food"}</SheetTitle>
                <SheetDescription>Enter nutrition per 100 g or 100 ml.</SheetDescription>
              </SheetHeader>
              <div className="grid grid-cols-2 gap-3 overflow-y-auto px-4">
                <div className="col-span-2 space-y-1.5"><Label htmlFor="custom-food-name">Name</Label><Input id="custom-food-name" value={customForm.name} onChange={(event) => setCustomForm((form) => ({ ...form, name: event.target.value }))} placeholder="e.g. Homemade granola" autoFocus /></div>
                <div className="col-span-2 space-y-1.5"><Label htmlFor="custom-food-variant">Variant (optional)</Label><Input id="custom-food-variant" value={customForm.variant} onChange={(event) => setCustomForm((form) => ({ ...form, variant: event.target.value }))} placeholder="e.g. Baked" /></div>
                <div className="col-span-2 space-y-1.5"><Label htmlFor="custom-food-aliases">Search aliases (optional)</Label><Input id="custom-food-aliases" value={customForm.aliases} onChange={(event) => setCustomForm((form) => ({ ...form, aliases: event.target.value }))} placeholder="Romanian name, another name" /><p className="text-xs text-muted-foreground">Separate aliases with commas.</p></div>
                <div className="col-span-2 space-y-1.5"><Label htmlFor="custom-food-unit">Nutrition basis</Label><Select value={customForm.basisUnit} onValueChange={(value) => setCustomForm((form) => ({ ...form, basisUnit: value as "g" | "ml" }))}><SelectTrigger id="custom-food-unit" className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="g">Per 100 g</SelectItem><SelectItem value="ml">Per 100 ml</SelectItem></SelectContent></Select></div>
                {([
                  ["calories", "Calories (kcal)"],
                  ["protein", "Protein (g)"],
                  ["carbs", "Carbs (g)"],
                  ["fat", "Fat (g)"],
                ] as const).map(([field, label]) => (
                  <div key={field} className="space-y-1.5"><Label htmlFor={`custom-food-${field}`}>{label}</Label><NumberInput id={`custom-food-${field}`} decimal value={customForm[field]} onChange={(event) => setCustomForm((form) => ({ ...form, [field]: event.target.value }))} placeholder="0" /></div>
                ))}
              </div>
              <SheetFooter><Button type="button" size="lg" onClick={() => void saveCustomFood()}>{editingCustom ? "Save and continue" : "Create and continue"}</Button></SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(nextOpen) => !nextOpen && setPendingDelete(null)}
        title="Delete custom food?"
        description={pendingDelete ? `${pendingDelete.name} will be removed from search. Previously logged entries will stay unchanged.` : undefined}
        confirmLabel="Delete food"
        destructive
        onConfirm={() => void confirmDeleteCustom()}
      />
    </>
  );
}
