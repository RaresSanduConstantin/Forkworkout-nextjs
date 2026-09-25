"use client";

import * as React from "react";
import {
  ArrowLeft,
  Barcode,
  ChefHat,
  Globe2,
  Loader2,
  Pencil,
  Plus,
  ScanSearch,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { BarcodeScannerPanel } from "@/components/nutrition/BarcodeScannerPanel";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
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
import { nutrientsForQuantity, sumNutrients } from "@/lib/nutrition/calculations";
import {
  barcodeDraftToFood,
  fetchOpenFoodFactsProduct,
  type BarcodeProductDraft,
} from "@/lib/nutrition/barcodes";
import {
  searchOnlineFoods,
  type OnlineFoodSearchSources,
} from "@/lib/nutrition/usda";
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
  NutritionSavedMeal,
  NutritionSavedMealItem,
} from "@/lib/nutrition/types";
import {
  cacheNutritionBarcodeProduct,
  getCachedNutritionBarcodeProduct,
} from "@/lib/storage/nutrition-barcode-storage";
import { cacheNutritionUsdaFood } from "@/lib/storage/nutrition-usda-storage";
import {
  deleteCustomNutritionFood,
  getNutritionFoodPreferences,
  nutritionFoodKey,
  recordNutritionFoodUse,
  setNutritionFoodFavourite,
  upsertCustomNutritionFood,
} from "@/lib/storage/nutrition-food-storage";
import { addNutritionEntry, updateNutritionEntry } from "@/lib/storage/nutrition-storage";
import {
  getNutritionSavedMeals,
  setNutritionSavedMealFavourite,
} from "@/lib/storage/nutrition-meal-storage";

const MEAL_LABELS: Record<NutritionMeal, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
};

const number = (value: number) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value);

type View = "browse" | "barcode" | "online" | "barcode_edit" | "quantity" | "custom";

const EMPTY_CUSTOM_FORM = {
  name: "",
  aliases: "",
  variant: "",
  basisAmount: "100",
  basisUnit: "g" as "g" | "ml",
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
};

type BarcodeForm = {
  barcode: string;
  name: string;
  brand: string;
  basisUnit: "g" | "ml";
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fibre: string;
  sugar: string;
  sodium: string;
  sourceReference?: string;
};

function draftToBarcodeForm(draft: BarcodeProductDraft): BarcodeForm {
  const input = (value: number | undefined) =>
    value === undefined ? "" : String(Math.round(value * 100) / 100);
  return {
    barcode: draft.barcode,
    name: draft.name,
    brand: draft.brand,
    basisUnit: draft.basisUnit,
    calories: input(draft.caloriesKcal),
    protein: input(draft.proteinG),
    carbs: input(draft.carbsG),
    fat: input(draft.fatG),
    fibre: input(draft.fibreG),
    sugar: input(draft.sugarG),
    sodium: input(draft.sodiumMg),
    sourceReference: draft.sourceReference,
  };
}

export function FoodPickerSheet({
  open,
  onOpenChange,
  dayKey,
  initialMeal,
  entry,
  onSaved,
  onPhotoScan,
  onSavedMeal,
  onCreateRecipe,
  mode = "log",
  onIngredientSelected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayKey: string;
  initialMeal: NutritionMeal;
  entry?: NutritionEntry | null;
  onSaved: () => void;
  onPhotoScan: (meal: NutritionMeal) => void;
  onSavedMeal: (savedMeal: NutritionSavedMeal, destinationMeal: NutritionMeal) => void;
  onCreateRecipe?: (meal: NutritionMeal) => void;
  mode?: "log" | "ingredient";
  onIngredientSelected?: (item: NutritionSavedMealItem) => void;
}) {
  const [view, setView] = React.useState<View>("browse");
  const [meal, setMeal] = React.useState<NutritionMeal>(initialMeal);
  const [foods, setFoods] = React.useState<NutritionFood[]>([]);
  const [savedMeals, setSavedMeals] = React.useState<NutritionSavedMeal[]>([]);
  const [preferences, setPreferences] = React.useState<NutritionFoodPreference[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [selectedFood, setSelectedFood] = React.useState<NutritionFood | null>(null);
  const [quantity, setQuantity] = React.useState("100");
  const [editingCustom, setEditingCustom] = React.useState<NutritionFood | null>(null);
  const [customForm, setCustomForm] = React.useState(EMPTY_CUSTOM_FORM);
  const [pendingDelete, setPendingDelete] = React.useState<NutritionFood | null>(null);
  const [barcodeForm, setBarcodeForm] = React.useState<BarcodeForm | null>(null);
  const [barcodeReturnQuantity, setBarcodeReturnQuantity] = React.useState<string | null>(null);
  const [barcodeLookupLoading, setBarcodeLookupLoading] = React.useState(false);
  const [barcodeLookupError, setBarcodeLookupError] = React.useState<string | null>(null);
  const barcodeLookupControllerRef = React.useRef<AbortController | null>(null);
  const [barcodeEditReturnView, setBarcodeEditReturnView] = React.useState<
    "browse" | "barcode"
  >("barcode");
  const [onlineResults, setOnlineResults] = React.useState<NutritionFood[]>([]);
  const [onlineSearchQuery, setOnlineSearchQuery] = React.useState("");
  const [onlineSearchLoading, setOnlineSearchLoading] = React.useState(false);
  const [onlineSearchError, setOnlineSearchError] = React.useState<string | null>(null);
  const [onlineSources, setOnlineSources] =
    React.useState<OnlineFoodSearchSources | null>(null);
  const onlineSearchControllerRef = React.useRef<AbortController | null>(null);

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
    setBarcodeForm(null);
    setBarcodeReturnQuantity(null);
    setBarcodeLookupLoading(false);
    setBarcodeLookupError(null);
    setBarcodeEditReturnView("barcode");
    setOnlineResults([]);
    setOnlineSearchQuery("");
    setOnlineSearchLoading(false);
    setOnlineSearchError(null);
    setOnlineSources(null);
    setSavedMeals(getNutritionSavedMeals());
    barcodeLookupControllerRef.current?.abort();
    onlineSearchControllerRef.current?.abort();
    void reloadFoods(true).then((loadedFoods) => {
      if (
        !entry?.foodSnapshot ||
        (entry.source !== "builtin" &&
          entry.source !== "usda" &&
          entry.source !== "custom" &&
          entry.source !== "barcode")
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
          brand: entry.foodSnapshot.brand,
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

  React.useEffect(
    () => () => {
      barcodeLookupControllerRef.current?.abort();
      onlineSearchControllerRef.current?.abort();
    },
    []
  );

  React.useEffect(() => {
    if (!open) {
      barcodeLookupControllerRef.current?.abort();
      onlineSearchControllerRef.current?.abort();
    }
  }, [open]);

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

  const lookupBarcode = async (barcode: string) => {
    setBarcodeLookupError(null);
    setBarcodeReturnQuantity(null);
    const cached = getCachedNutritionBarcodeProduct(barcode);
    if (cached) {
      selectFood(cached);
      toast.success("Loaded saved barcode product");
      return;
    }

    barcodeLookupControllerRef.current?.abort();
    const controller = new AbortController();
    barcodeLookupControllerRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    setBarcodeLookupLoading(true);
    try {
      const product = await fetchOpenFoodFactsProduct(barcode, controller.signal);
      setBarcodeForm(
        draftToBarcodeForm(
          product ?? {
            barcode,
            name: "",
            brand: "",
            basisUnit: "g",
          }
        )
      );
      setBarcodeEditReturnView("barcode");
      setView("barcode_edit");
      if (!product) {
        toast.info("Product not found. You can enter its label values once and save it.");
      }
    } catch (reason) {
      if (controller.signal.aborted) {
        setBarcodeLookupError("The lookup took too long. Check your connection and try again.");
      } else {
        setBarcodeLookupError(
          reason instanceof Error ? reason.message : "The product lookup failed."
        );
      }
    } finally {
      window.clearTimeout(timeout);
      if (barcodeLookupControllerRef.current === controller) {
        barcodeLookupControllerRef.current = null;
        setBarcodeLookupLoading(false);
      }
    }
  };

  const searchOnline = async () => {
    const term = query.trim();
    if (term.length < 2) {
      toast.error("Enter at least two characters to search online.");
      return;
    }
    onlineSearchControllerRef.current?.abort();
    const controller = new AbortController();
    onlineSearchControllerRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    setOnlineSearchQuery(term);
    setOnlineResults([]);
    setOnlineSearchError(null);
    setOnlineSources(null);
    setOnlineSearchLoading(true);
    setView("online");
    try {
      const result = await searchOnlineFoods(term, controller.signal);
      setOnlineResults(result.foods);
      setOnlineSources(result.sources);
    } catch (reason) {
      setOnlineSearchError(
        controller.signal.aborted
          ? "The online search took too long. Check your connection and try again."
          : reason instanceof Error
            ? reason.message
            : "The online food search failed."
      );
    } finally {
      window.clearTimeout(timeout);
      if (onlineSearchControllerRef.current === controller) {
        onlineSearchControllerRef.current = null;
        setOnlineSearchLoading(false);
      }
    }
  };

  const chooseOnlineFood = async (food: NutritionFood) => {
    const saved =
      food.source === "usda"
        ? cacheNutritionUsdaFood(food)
        : food.source === "barcode"
          ? cacheNutritionBarcodeProduct(food)
          : null;
    if (!saved) {
      toast.error("Couldn't save this food on your device.");
      return;
    }
    await reloadFoods();
    setSelectedFood(saved);
    setQuantity(String(saved.basisAmount));
    setView("quantity");
    toast.success(
      `${food.source === "usda" ? "USDA food" : "Open Food Facts product"} saved for offline use`
    );
  };

  const editBarcodeProduct = (food: NutritionFood, returnQuantity: string | null) => {
    setBarcodeReturnQuantity(returnQuantity);
    setBarcodeForm(
      draftToBarcodeForm({
        barcode: food.id,
        name: food.name,
        brand: food.brand ?? "",
        basisUnit: food.basisUnit,
        caloriesKcal: food.nutrients.caloriesKcal,
        proteinG: food.nutrients.proteinG,
        carbsG: food.nutrients.carbsG,
        fatG: food.nutrients.fatG,
        fibreG: food.nutrients.fibreG,
        sugarG: food.nutrients.sugarG,
        sodiumMg: food.nutrients.sodiumMg,
        sourceReference: food.sourceReference,
      })
    );
    setBarcodeEditReturnView("browse");
    setView("barcode_edit");
  };

  const saveBarcodeProduct = async () => {
    if (!barcodeForm?.name.trim()) {
      toast.error("Enter the product name.");
      return;
    }
    const required = {
      caloriesKcal: Number.parseFloat(barcodeForm.calories),
      proteinG: Number.parseFloat(barcodeForm.protein),
      carbsG: Number.parseFloat(barcodeForm.carbs),
      fatG: Number.parseFloat(barcodeForm.fat),
    };
    if (
      Object.values(required).some((value) => !Number.isFinite(value) || value < 0)
    ) {
      toast.error("Confirm calories, protein, carbs, and fat using values of zero or more.");
      return;
    }
    const optional = (value: string) => {
      if (!value.trim()) return undefined;
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    };
    const fibreG = optional(barcodeForm.fibre);
    const sugarG = optional(barcodeForm.sugar);
    const sodiumMg = optional(barcodeForm.sodium);
    if ([fibreG, sugarG, sodiumMg].some((value) => value === null)) {
      toast.error("Optional nutrient values must be zero or more.");
      return;
    }
    const draft: BarcodeProductDraft = {
      barcode: barcodeForm.barcode,
      name: barcodeForm.name,
      brand: barcodeForm.brand,
      basisUnit: barcodeForm.basisUnit,
      caloriesKcal: required.caloriesKcal,
      proteinG: required.proteinG,
      carbsG: required.carbsG,
      fatG: required.fatG,
      fibreG: fibreG ?? undefined,
      sugarG: sugarG ?? undefined,
      sodiumMg: sodiumMg ?? undefined,
      sourceReference: barcodeForm.sourceReference,
    };
    const saved = cacheNutritionBarcodeProduct(
      barcodeDraftToFood(draft, {
        ...required,
        fibreG: fibreG ?? undefined,
        sugarG: sugarG ?? undefined,
        sodiumMg: sodiumMg ?? undefined,
      })
    );
    if (!saved) {
      toast.error("Couldn't save this product on your device.");
      return;
    }
    await reloadFoods();
    setSelectedFood(saved);
    setQuantity(barcodeReturnQuantity ?? String(saved.basisAmount));
    setBarcodeReturnQuantity(null);
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

  const toggleSavedMealFavourite = (savedMeal: NutritionSavedMeal) => {
    if (!setNutritionSavedMealFavourite(savedMeal.id, !savedMeal.favourite)) {
      toast.error("Couldn't update saved meal favourites.");
      return;
    }
    setSavedMeals(getNutritionSavedMeals());
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
    const item: NutritionSavedMealItem = {
      name: selectedFood.variant
        ? `${selectedFood.name} · ${selectedFood.variant}`
        : selectedFood.name,
      source: selectedFood.source,
      quantity: { amount: parsedQuantity, unit: selectedFood.basisUnit },
      nutrients,
      foodSnapshot: {
        foodId: selectedFood.id,
        name: selectedFood.name,
        brand: selectedFood.brand,
        variant: selectedFood.variant,
        basisAmount: selectedFood.basisAmount,
        basisUnit: selectedFood.basisUnit,
        nutrients: selectedFood.nutrients,
        source: selectedFood.source,
        sourceReference: selectedFood.sourceReference,
      },
    };
    if (mode === "ingredient") {
      if (!onIngredientSelected) {
        toast.error("Couldn't add that ingredient.");
        return;
      }
      onIngredientSelected(item);
      onOpenChange(false);
      toast.success(`${item.name} added to the recipe`);
      return;
    }
    const input = {
      dayKey,
      meal,
      ...item,
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
            basisAmount: String(food.basisAmount),
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
    const basisAmount = Number.parseFloat(customForm.basisAmount);
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
    if (!Number.isFinite(basisAmount) || basisAmount <= 0 || basisAmount > 10_000) {
      toast.error("Enter the amount those nutrition values are based on.");
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
        basisAmount,
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
    setQuantity(String(saved.basisAmount));
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
          className={`mx-auto h-[92dvh] max-w-xl overflow-hidden rounded-t-2xl pb-[env(safe-area-inset-bottom)] ${view === "barcode" ? "landscape:max-w-4xl" : ""}`}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          {view === "browse" && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle>{mode === "ingredient" ? "Add ingredient" : "Add Food"}</SheetTitle>
                <SheetDescription>
                  {mode === "ingredient"
                    ? "Search locally or online, scan a barcode, or use a photo."
                    : "Search the offline catalog or use a recent favourite."}
                </SheetDescription>
              </SheetHeader>
              <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
                {mode === "log" && savedMeals.length > 0 && (
                  <section className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Saved meals
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {savedMeals.map((savedMeal) => {
                        const totals = sumNutrients(savedMeal.items);
                        return (
                          <div
                            key={savedMeal.id}
                            className="relative min-w-[9.5rem] max-w-[12rem] shrink-0 rounded-xl border bg-card"
                          >
                            <button
                              type="button"
                              className="size-full rounded-xl p-3 pr-12 text-left transition hover:bg-muted/50"
                              onClick={() => onSavedMeal(savedMeal, meal)}
                            >
                              <span className="block truncate text-sm font-medium">
                                {savedMeal.name}
                              </span>
                              <span className="mt-1 block text-xs text-muted-foreground">
                                {savedMeal.kind === "recipe" && savedMeal.servings
                                  ? `${number(savedMeal.servings)} servings · ${number(totals.caloriesKcal / savedMeal.servings)} kcal each`
                                  : `${savedMeal.items.length} foods · ${number(totals.caloriesKcal)} kcal`}
                              </span>
                            </button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-lg"
                              className="absolute right-0 top-0 size-11"
                              onClick={() => toggleSavedMealFavourite(savedMeal)}
                              aria-label={
                                savedMeal.favourite
                                  ? `Remove ${savedMeal.name} from favourites`
                                  : `Add ${savedMeal.name} to favourites`
                              }
                              aria-pressed={Boolean(savedMeal.favourite)}
                            >
                              <Star
                                className={`size-4 ${
                                  savedMeal.favourite
                                    ? "fill-amber-400 text-amber-500"
                                    : "text-muted-foreground"
                                }`}
                              />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
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
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setBarcodeLookupError(null);
                      setBarcodeReturnQuantity(null);
                      setView("barcode");
                    }}
                  >
                    <Barcode className="size-4" /> Scan barcode
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => onPhotoScan(meal)}>
                    <ScanSearch className="size-4" /> Photo scan
                  </Button>
                  <Button type="button" variant="outline" className="col-span-2" onClick={() => openCustomForm()}>
                    <Plus className="size-4" /> Custom food
                  </Button>
                  {mode === "log" && onCreateRecipe && (
                    <Button type="button" variant="outline" className="col-span-2" onClick={() => onCreateRecipe(meal)}>
                      <ChefHat className="size-4" /> Create recipe
                    </Button>
                  )}
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
                                {food.brand ? `${food.brand} · ` : ""}{food.variant ? `${food.variant} · ` : ""}{number(food.nutrients.caloriesKcal)} kcal / {food.basisAmount}{food.basisUnit}
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
                            {food.source === "barcode" && (
                              <Button type="button" variant="ghost" size="icon-sm" onClick={() => editBarcodeProduct(food, null)} aria-label={`Edit ${food.name}`}>
                                <Pencil className="size-4" />
                              </Button>
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
                {query.trim().length >= 2 && !loading && (
                  <Button type="button" variant="outline" className="w-full" onClick={() => void searchOnline()}>
                    <Globe2 className="size-4" /> Search online for “{query.trim().slice(0, 28)}{query.trim().length > 28 ? "…" : ""}”
                  </Button>
                )}
                <p className="text-center text-[11px] text-muted-foreground">Online search checks USDA FoodData Central and Open Food Facts. Saved results work offline.</p>
              </div>
            </>
          )}

          {view === "barcode" && (
            <>
              <SheetHeader className="text-left">
                <button type="button" className="mb-1 flex w-fit items-center gap-1 text-sm text-muted-foreground" onClick={() => setView("browse")}>
                  <ArrowLeft className="size-4" /> Back to search
                </button>
                <SheetTitle>Scan barcode</SheetTitle>
                <SheetDescription>
                  Scan an EAN or UPC code. Product data is saved locally after confirmation.
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                <BarcodeScannerPanel
                  active={!barcodeLookupLoading}
                  lookupLoading={barcodeLookupLoading}
                  lookupError={barcodeLookupError}
                  onDetected={(barcode) => void lookupBarcode(barcode)}
                />
                <p className="mt-3 text-center text-[11px] text-muted-foreground">
                  Product lookup by Open Food Facts requires an internet connection the first time.
                </p>
              </div>
            </>
          )}

          {view === "online" && (
            <>
              <SheetHeader className="text-left">
                <button type="button" className="mb-1 flex w-fit items-center gap-1 text-sm text-muted-foreground" onClick={() => setView("browse")}>
                  <ArrowLeft className="size-4" /> Back to offline search
                </button>
                <SheetTitle>Online results</SheetTitle>
                <SheetDescription>Foods matching “{onlineSearchQuery}” from USDA FoodData Central and Open Food Facts.</SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
                {onlineSearchLoading ? (
                  <div className="flex h-36 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Searching USDA and Open Food Facts…</div>
                ) : onlineSearchError ? (
                  <div className="space-y-3 rounded-xl border border-dashed p-6 text-center"><p className="text-sm text-muted-foreground">{onlineSearchError}</p><Button type="button" variant="outline" onClick={() => void searchOnline()}>Try again</Button></div>
                ) : onlineResults.length === 0 ? (
                  <div className="space-y-3 rounded-xl border border-dashed p-6 text-center"><p className="text-sm text-muted-foreground">No foods found from either source. You can add this as a custom food instead.</p><Button type="button" variant="outline" onClick={() => openCustomForm()}>Create custom food</Button></div>
                ) : (
                  <ul className="divide-y rounded-xl border">
                    {onlineResults.map((food) => (
                      <li key={`${food.source}:${food.id}`}>
                        <button type="button" className="w-full px-3 py-3 text-left transition hover:bg-muted/50" onClick={() => void chooseOnlineFood(food)}>
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">{food.name}</span>
                            <Badge variant="secondary" className="shrink-0 text-[10px]">
                              {food.source === "usda" ? "USDA" : "Open Food Facts"}
                            </Badge>
                          </span>
                          {food.brand ? <span className="block truncate text-xs text-muted-foreground">{food.brand}</span> : null}
                          <span className="block truncate text-xs text-muted-foreground">{number(food.nutrients.caloriesKcal)} kcal · P {number(food.nutrients.proteinG)} g · C {number(food.nutrients.carbsG)} g · F {number(food.nutrients.fatG)} g / 100 g</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-center text-[11px] text-muted-foreground">
                  {onlineSources?.usda === "not_configured"
                    ? "USDA is not configured, so these results are from Open Food Facts. Selecting one saves it for offline use."
                    : onlineSources &&
                        (onlineSources.usda === "unavailable" ||
                          onlineSources.openFoodFacts === "unavailable")
                      ? "One source was unavailable. Results from the other source can still be saved for offline use."
                      : "Selecting a result saves it on this device for later offline use."}
                </p>
              </div>
            </>
          )}

          {view === "barcode_edit" && barcodeForm && (
            <>
              <SheetHeader className="text-left">
                <button type="button" className="mb-1 flex w-fit items-center gap-1 text-sm text-muted-foreground" onClick={() => setView(barcodeEditReturnView)}>
                  <ArrowLeft className="size-4" /> {barcodeEditReturnView === "barcode" ? "Scan another code" : "Back to search"}
                </button>
                <SheetTitle>Confirm product</SheetTitle>
                <SheetDescription>
                  Check the package and correct any missing or inaccurate values before logging.
                </SheetDescription>
              </SheetHeader>
              <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto px-4 pb-4">
                <div className="col-span-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Barcode <span className="font-medium tabular-nums text-foreground">{barcodeForm.barcode}</span>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="barcode-product-name">Product name</Label>
                  <Input id="barcode-product-name" value={barcodeForm.name} onChange={(event) => setBarcodeForm((form) => form ? { ...form, name: event.target.value } : form)} placeholder="e.g. Greek yoghurt" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="barcode-product-brand">Brand (optional)</Label>
                  <Input id="barcode-product-brand" value={barcodeForm.brand} onChange={(event) => setBarcodeForm((form) => form ? { ...form, brand: event.target.value } : form)} placeholder="Brand name" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="barcode-product-unit">Nutrition basis</Label>
                  <Select value={barcodeForm.basisUnit} onValueChange={(value) => setBarcodeForm((form) => form ? { ...form, basisUnit: value as "g" | "ml" } : form)}>
                    <SelectTrigger id="barcode-product-unit" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="g">Per 100 g</SelectItem><SelectItem value="ml">Per 100 ml</SelectItem></SelectContent>
                  </Select>
                </div>
                {([
                  ["calories", "Calories (kcal)"],
                  ["protein", "Protein (g)"],
                  ["carbs", "Carbs (g)"],
                  ["fat", "Fat (g)"],
                ] as const).map(([field, label]) => (
                  <div key={field} className="space-y-1.5">
                    <Label htmlFor={`barcode-product-${field}`}>{label}</Label>
                    <NumberInput id={`barcode-product-${field}`} decimal value={barcodeForm[field]} onChange={(event) => setBarcodeForm((form) => form ? { ...form, [field]: event.target.value } : form)} placeholder="Required" />
                  </div>
                ))}
                <p className="col-span-2 mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Optional details</p>
                {([
                  ["fibre", "Fibre (g)"],
                  ["sugar", "Sugar (g)"],
                  ["sodium", "Sodium (mg)"],
                ] as const).map(([field, label]) => (
                  <div key={field} className="space-y-1.5">
                    <Label htmlFor={`barcode-product-${field}`}>{label}</Label>
                    <NumberInput id={`barcode-product-${field}`} decimal value={barcodeForm[field]} onChange={(event) => setBarcodeForm((form) => form ? { ...form, [field]: event.target.value } : form)} placeholder="Optional" />
                  </div>
                ))}
                {barcodeForm.sourceReference && (
                  <a href={barcodeForm.sourceReference} target="_blank" rel="noopener noreferrer" className="col-span-2 text-center text-xs text-primary hover:underline">
                    View this product on Open Food Facts
                  </a>
                )}
              </div>
              <SheetFooter>
                <Button type="button" size="lg" onClick={() => void saveBarcodeProduct()}>
                  Confirm and set amount
                </Button>
              </SheetFooter>
            </>
          )}

          {view === "quantity" && selectedFood && calculated && (
            <>
              <SheetHeader className="text-left">
                <button type="button" className="mb-1 flex w-fit items-center gap-1 text-sm text-muted-foreground" onClick={() => setView("browse")}>
                  <ArrowLeft className="size-4" /> Back to search
                </button>
                <SheetTitle>{entry ? `Edit ${selectedFood.name}` : selectedFood.name}</SheetTitle>
                <SheetDescription>{[selectedFood.brand, selectedFood.variant ?? `Per ${selectedFood.basisAmount}${selectedFood.basisUnit}`].filter(Boolean).join(" · ")}</SheetDescription>
              </SheetHeader>
              <div className="grid grid-cols-2 gap-3 overflow-y-auto px-4">
                {mode === "log" && (
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
                )}
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="food-quantity">Amount ({selectedFood.basisUnit})</Label>
                  <NumberInput id="food-quantity" decimal value={quantity} onChange={(event) => setQuantity(event.target.value)} />
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
                {selectedFood.source === "barcode" && (
                  <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                    {selectedFood.sourceReference ? (
                      <a href={selectedFood.sourceReference} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        Open Food Facts product
                      </a>
                    ) : (
                      <span>Saved barcode product</span>
                    )}
                    <Button type="button" size="sm" variant="ghost" onClick={() => editBarcodeProduct(selectedFood, quantity)}>
                      <Pencil className="size-4" /> Edit product values
                    </Button>
                  </div>
                )}
                {selectedFood.source === "usda" && selectedFood.sourceReference && (
                  <div className="col-span-2 rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                    <a href={selectedFood.sourceReference} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      View on USDA FoodData Central
                    </a>
                  </div>
                )}
              </div>
              <SheetFooter>
                <Button type="button" size="lg" onClick={saveSelectedFood}>
                  {mode === "ingredient"
                    ? "Add ingredient"
                    : entry
                      ? "Save changes"
                      : `Add to ${MEAL_LABELS[meal]}`}
                </Button>
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
                <SheetDescription>Enter nutrition for the serving size you have available.</SheetDescription>
              </SheetHeader>
              <div className="grid grid-cols-2 gap-3 overflow-y-auto px-4">
                <div className="col-span-2 space-y-1.5"><Label htmlFor="custom-food-name">Name</Label><Input id="custom-food-name" value={customForm.name} onChange={(event) => setCustomForm((form) => ({ ...form, name: event.target.value }))} placeholder="e.g. Homemade granola" /></div>
                <div className="col-span-2 space-y-1.5"><Label htmlFor="custom-food-variant">Variant (optional)</Label><Input id="custom-food-variant" value={customForm.variant} onChange={(event) => setCustomForm((form) => ({ ...form, variant: event.target.value }))} placeholder="e.g. Baked" /></div>
                <div className="col-span-2 space-y-1.5"><Label htmlFor="custom-food-aliases">Search aliases (optional)</Label><Input id="custom-food-aliases" value={customForm.aliases} onChange={(event) => setCustomForm((form) => ({ ...form, aliases: event.target.value }))} placeholder="Romanian name, another name" /><p className="text-xs text-muted-foreground">Separate aliases with commas.</p></div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="custom-food-basis">These nutrition values are for</Label>
                  <div className="grid grid-cols-[1fr_7rem] gap-2">
                    <NumberInput id="custom-food-basis" decimal value={customForm.basisAmount} onChange={(event) => setCustomForm((form) => ({ ...form, basisAmount: event.target.value }))} placeholder="e.g. 40" />
                    <Select value={customForm.basisUnit} onValueChange={(value) => setCustomForm((form) => ({ ...form, basisUnit: value as "g" | "ml" }))}>
                      <SelectTrigger id="custom-food-unit" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="g">grams</SelectItem><SelectItem value="ml">ml</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">Enter the serving shown on your label, such as 40 g. ForkWorkout scales it automatically.</p>
                </div>
                {([
                  ["calories", "Calories (kcal)"],
                  ["protein", "Protein (g)"],
                  ["carbs", "Carbs (g)"],
                  ["fat", "Fat (g)"],
                ] as const).map(([field, label]) => (
                  <div key={field} className="space-y-1.5"><Label htmlFor={`custom-food-${field}`}>{label}</Label><NumberInput id={`custom-food-${field}`} decimal value={customForm[field]} onChange={(event) => setCustomForm((form) => ({ ...form, [field]: event.target.value }))} placeholder="0" /></div>
                ))}
                {(() => {
                  const basis = Number.parseFloat(customForm.basisAmount);
                  const values = {
                    caloriesKcal: Number.parseFloat(customForm.calories),
                    proteinG: Number.parseFloat(customForm.protein),
                    carbsG: Number.parseFloat(customForm.carbs),
                    fatG: Number.parseFloat(customForm.fat),
                  };
                  if (
                    !Number.isFinite(basis) ||
                    basis <= 0 ||
                    Object.values(values).some((value) => !Number.isFinite(value) || value < 0)
                  ) return null;
                  const per100 = nutrientsForQuantity(values, 100, basis);
                  return (
                    <div className="col-span-2 rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">Equivalent per 100{customForm.basisUnit}</p>
                      <p className="mt-1 tabular-nums">{number(per100.caloriesKcal)} kcal · P {number(per100.proteinG)} g · C {number(per100.carbsG)} g · F {number(per100.fatG)} g</p>
                    </div>
                  );
                })()}
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
