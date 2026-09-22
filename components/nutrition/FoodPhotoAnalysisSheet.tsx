"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  Camera,
  ImagePlus,
  ImageUp,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { dayKeyToDate } from "@/lib/date/day-key";
import { nutrientsForQuantity } from "@/lib/nutrition/calculations";
import {
  AIPhotoAnalysisError,
  analyzeFoodPhoto,
  fetchAIPhotoUsage,
  prepareAIPhoto,
  type AIPhotoAnalysis,
  type AIPhotoUsage,
} from "@/lib/nutrition/ai-photo";
import type {
  NutritionMeal,
  NutritionNutrients,
  NutritionSavedMealItem,
} from "@/lib/nutrition/types";
import { getAnonymousInstallationId } from "@/lib/storage/anonymous-installation";
import { addNutritionEntries } from "@/lib/storage/nutrition-storage";

const MEAL_LABELS: Record<NutritionMeal, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
};

type DraftFood = {
  name: string;
  weight: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  confidence: number;
  basisNutrients: NutritionNutrients;
};

function inputNumber(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function analysisDraft(analysis: AIPhotoAnalysis): DraftFood[] {
  return analysis.foods.map((food) => {
    const basisNutrients = nutrientsForQuantity(
      food.nutrients,
      100,
      food.estimatedWeightGrams
    );
    return {
      name: food.name,
      weight: inputNumber(food.estimatedWeightGrams),
      calories: inputNumber(food.nutrients.caloriesKcal),
      protein: inputNumber(food.nutrients.proteinG),
      carbs: inputNumber(food.nutrients.carbsG),
      fat: inputNumber(food.nutrients.fatG),
      confidence: food.confidence,
      basisNutrients,
    };
  });
}

function parseDraftFoods(drafts: DraftFood[]) {
  const parsed = drafts.map((draft) => ({
    name: draft.name.trim(),
    weight: Number.parseFloat(draft.weight),
    nutrients: {
      caloriesKcal: Number.parseFloat(draft.calories),
      proteinG: Number.parseFloat(draft.protein),
      carbsG: Number.parseFloat(draft.carbs),
      fatG: Number.parseFloat(draft.fat),
    } satisfies NutritionNutrients,
  }));
  if (parsed.some((food) => !food.name)) return null;
  if (parsed.some((food) => !Number.isFinite(food.weight) || food.weight <= 0)) return null;
  if (
    parsed.some((food) =>
      Object.values(food.nutrients).some((value) => !Number.isFinite(value) || value < 0)
    )
  ) {
    return null;
  }
  return parsed;
}

function errorMessage(error: unknown): string {
  if (error instanceof AIPhotoAnalysisError) return error.message;
  if (error instanceof DOMException && error.name === "AbortError") {
    return "The analysis took too long. Check your connection and try again.";
  }
  return error instanceof Error ? error.message : "The photo could not be analyzed.";
}

export function FoodPhotoAnalysisSheet({
  open,
  onOpenChange,
  dayKey,
  initialMeal,
  onSaved,
  mode = "log",
  onIngredientsSelected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayKey: string;
  initialMeal: NutritionMeal;
  onSaved: () => void;
  mode?: "log" | "ingredient";
  onIngredientsSelected?: (items: NutritionSavedMealItem[]) => void;
}) {
  const [meal, setMeal] = React.useState<NutritionMeal>(initialMeal);
  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [knownWeight, setKnownWeight] = React.useState("");
  const [analysis, setAnalysis] = React.useState<AIPhotoAnalysis | null>(null);
  const [drafts, setDrafts] = React.useState<DraftFood[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [scannerDisabledReason, setScannerDisabledReason] = React.useState<string | null>(null);
  const [usage, setUsage] = React.useState<AIPhotoUsage | null>(null);
  const [usageLoading, setUsageLoading] = React.useState(false);
  const controllerRef = React.useRef<AbortController | null>(null);
  const usageControllerRef = React.useRef<AbortController | null>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);

  const clearPreview = React.useCallback(() => {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }, []);

  const reset = React.useCallback(() => {
    controllerRef.current?.abort();
    clearPreview();
    setFile(null);
    setKnownWeight("");
    setAnalysis(null);
    setDrafts([]);
    setError(null);
    setAnalyzing(false);
    setSaving(false);
  }, [clearPreview]);

  const refreshUsage = React.useCallback(async () => {
    usageControllerRef.current?.abort();
    const controller = new AbortController();
    usageControllerRef.current = controller;
    setUsageLoading(true);
    try {
      const anonymousDeviceId = await getAnonymousInstallationId();
      const nextUsage = await fetchAIPhotoUsage(anonymousDeviceId, controller.signal);
      if (!controller.signal.aborted) setUsage(nextUsage);
    } catch {
      if (!controller.signal.aborted) setUsage(null);
    } finally {
      if (usageControllerRef.current === controller) {
        usageControllerRef.current = null;
        setUsageLoading(false);
      }
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      setMeal(initialMeal);
      reset();
      setUsage(null);
      void refreshUsage();
    } else {
      controllerRef.current?.abort();
      usageControllerRef.current?.abort();
    }
  }, [initialMeal, open, refreshUsage, reset]);

  React.useEffect(
    () => () => {
      controllerRef.current?.abort();
      usageControllerRef.current?.abort();
      clearPreview();
    },
    [clearPreview]
  );

  const chooseFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!next) return;
    clearPreview();
    setFile(next);
    setAnalysis(null);
    setDrafts([]);
    setError(null);
    setPreviewUrl(URL.createObjectURL(next));
  };

  const analyze = async () => {
    if (!file) {
      setError("Take or choose a food photo first.");
      return;
    }
    const parsedWeight = knownWeight.trim() ? Number.parseFloat(knownWeight) : undefined;
    if (
      parsedWeight !== undefined &&
      (!Number.isFinite(parsedWeight) || parsedWeight <= 0 || parsedWeight > 100_000)
    ) {
      setError("Enter a known weight greater than zero, or leave it blank.");
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setAnalyzing(true);
    setError(null);
    try {
      const [image, anonymousDeviceId] = await Promise.all([
        prepareAIPhoto(file),
        getAnonymousInstallationId(),
      ]);
      const result = await analyzeFoodPhoto({
        image,
        weightGrams: parsedWeight,
        anonymousDeviceId,
        signal: controller.signal,
      });
      setAnalysis(result);
      setDrafts(analysisDraft(result));
    } catch (reason) {
      if (
        reason instanceof AIPhotoAnalysisError &&
        (reason.code === "MONTHLY_BUDGET_REACHED" ||
          reason.code === "AI_BILLING_UNAVAILABLE" ||
          reason.code === "SCANNER_UNAVAILABLE")
      ) {
        setScannerDisabledReason(errorMessage(reason));
      }
      setError(errorMessage(reason));
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setAnalyzing(false);
      }
      void refreshUsage();
    }
  };

  const updateDraft = (index: number, field: keyof DraftFood, value: string) => {
    setDrafts((current) =>
      current.map((draft, draftIndex) => {
        if (draftIndex !== index) return draft;
        if (field === "weight") {
          const nextWeight = Number.parseFloat(value);
          if (!Number.isFinite(nextWeight) || nextWeight <= 0) {
            return { ...draft, weight: value };
          }
          const scaled = nutrientsForQuantity(draft.basisNutrients, nextWeight, 100);
          return {
            ...draft,
            weight: value,
            calories: inputNumber(scaled.caloriesKcal),
            protein: inputNumber(scaled.proteinG),
            carbs: inputNumber(scaled.carbsG),
            fat: inputNumber(scaled.fatG),
          };
        }
        if (
          field === "calories" ||
          field === "protein" ||
          field === "carbs" ||
          field === "fat"
        ) {
          const nextValue = Number.parseFloat(value);
          const currentWeight = Number.parseFloat(draft.weight);
          const nutrientKey = {
            calories: "caloriesKcal",
            protein: "proteinG",
            carbs: "carbsG",
            fat: "fatG",
          }[field] as keyof NutritionNutrients;
          return {
            ...draft,
            [field]: value,
            basisNutrients:
              Number.isFinite(nextValue) && Number.isFinite(currentWeight) && currentWeight > 0
                ? {
                    ...draft.basisNutrients,
                    [nutrientKey]: (nextValue * 100) / currentWeight,
                  }
                : draft.basisNutrients,
          };
        }
        return { ...draft, [field]: value };
      })
    );
  };

  const save = () => {
    const parsed = parseDraftFoods(drafts);
    if (!parsed) {
      setError("Review every food and enter valid values of zero or more.");
      return;
    }
    const items = parsed.map(
      (food): NutritionSavedMealItem => ({
        name: food.name,
        source: "meal_photo",
        quantity: { amount: food.weight, unit: "g" },
        nutrients: food.nutrients,
        foodSnapshot: {
          name: food.name,
          basisAmount: 100,
          basisUnit: "g",
          nutrients: nutrientsForQuantity(food.nutrients, 100, food.weight),
          source: "meal_photo",
        },
      })
    );
    if (mode === "ingredient") {
      if (!onIngredientsSelected) {
        setError("These ingredients could not be added to the recipe.");
        return;
      }
      onIngredientsSelected(items);
      onOpenChange(false);
      toast.success(
        `${items.length} ${items.length === 1 ? "ingredient" : "ingredients"} added to the recipe`
      );
      return;
    }
    setSaving(true);
    const saved = addNutritionEntries(
      items.map((item) => ({
        dayKey,
        meal,
        ...item,
      }))
    );
    setSaving(false);
    if (!saved) {
      setError("The confirmed foods could not be saved on this device.");
      return;
    }
    onSaved();
    onOpenChange(false);
    toast.success(
      `${saved.length} ${saved.length === 1 ? "food" : "foods"} added to ${MEAL_LABELS[meal].toLowerCase()}`
    );
  };

  const totals = React.useMemo(() => {
    const parsed = parseDraftFoods(drafts);
    return parsed?.reduce<NutritionNutrients>(
      (total, food) => ({
        caloriesKcal: total.caloriesKcal + food.nutrients.caloriesKcal,
        proteinG: total.proteinG + food.nutrients.proteinG,
        carbsG: total.carbsG + food.nutrients.carbsG,
        fatG: total.fatG + food.nutrients.fatG,
      }),
      { caloriesKcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }
    );
  }, [drafts]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto h-[94dvh] max-w-xl overflow-hidden rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <SheetHeader className="text-left">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </span>
            <div>
              <SheetTitle>{mode === "ingredient" ? "Scan recipe ingredients" : "Analyze food photo"}</SheetTitle>
              <p className="text-xs text-muted-foreground">
                AI estimate · you review before anything is saved
              </p>
            </div>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
          <div
            className="flex items-center justify-between gap-3 rounded-xl border bg-muted/25 px-3 py-2.5"
            aria-live="polite"
          >
            <div>
              <p className="text-sm font-medium">Daily AI scans</p>
              <p className="text-xs text-muted-foreground">Per device allowance</p>
            </div>
            {usageLoading ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden /> Checking…
              </span>
            ) : usage ? (
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">
                  {usage.dailyRemaining} of {usage.dailyLimit} left today
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {usage.dailyLimit - usage.dailyRemaining} used
                </p>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Count unavailable</span>
            )}
          </div>

          {!analysis ? (
            <>
              <div className="relative flex min-h-52 items-center justify-center overflow-hidden rounded-2xl border border-dashed bg-muted/20 text-center">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="Selected food" className="max-h-72 w-full object-contain" />
                ) : (
                  <span className="space-y-2 p-6">
                    <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Camera className="size-5" />
                    </span>
                    <span className="block text-sm font-semibold">Add a food photo</span>
                    <span className="block text-xs text-muted-foreground">
                      Take a new photo or choose one from your gallery
                    </span>
                  </span>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={analyzing || scannerDisabledReason !== null}
                >
                  <Camera className="size-4" />
                  Take photo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={analyzing || scannerDisabledReason !== null}
                >
                  <ImageUp className="size-4" />
                  Choose from gallery
                </Button>
              </div>

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="hidden"
                onChange={chooseFile}
                disabled={analyzing || scannerDisabledReason !== null}
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={chooseFile}
                disabled={analyzing || scannerDisabledReason !== null}
              />

              {file && (
                <p className="truncate text-center text-xs text-muted-foreground">
                  Selected: {file.name}
                </p>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="photo-known-weight">Known total weight (g, optional)</Label>
                <NumberInput
                  id="photo-known-weight"
                  decimal
                  value={knownWeight}
                  onChange={(event) => setKnownWeight(event.target.value)}
                  placeholder="e.g. 350"
                  disabled={analyzing || scannerDisabledReason !== null}
                />
                <p className="text-xs text-muted-foreground">
                  A measured weight helps improve portion estimates.
                </p>
              </div>

              <div className="flex gap-2 rounded-xl border bg-muted/25 p-3 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                <p>
                  The photo is sent securely for this analysis only. It is not added to your local
                  diary; only values you confirm are saved.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/25 p-3">
                <div>
                  <p className="text-sm font-semibold">Review the estimate</p>
                  <p className="text-xs text-muted-foreground">
                    AI can be wrong. Adjust every value you know.
                  </p>
                </div>
                <Badge variant="secondary" className="capitalize">
                  {analysis.confidence} confidence
                </Badge>
              </div>

              {mode === "log" && (
                <div className="space-y-1.5">
                  <Label htmlFor="photo-meal">Meal</Label>
                  <Select value={meal} onValueChange={(value) => setMeal(value as NutritionMeal)}>
                    <SelectTrigger id="photo-meal" className="w-full">
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
              )}

              <div className="space-y-3">
                {drafts.map((draft, index) => (
                  <Card key={index} className="py-0">
                    <CardContent className="grid grid-cols-2 gap-3 p-4">
                      <div className="col-span-2 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor={`photo-food-${index}`}>Food {index + 1}</Label>
                          <span className="text-xs text-muted-foreground">
                            {Math.round(draft.confidence * 100)}% item confidence
                          </span>
                        </div>
                        <Input
                          id={`photo-food-${index}`}
                          value={draft.name}
                          maxLength={160}
                          onChange={(event) => updateDraft(index, "name", event.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`photo-weight-${index}`}>Weight (g)</Label>
                        <NumberInput id={`photo-weight-${index}`} decimal value={draft.weight} onChange={(event) => updateDraft(index, "weight", event.target.value)} />
                        <p className="text-[11px] text-muted-foreground">Changing grams scales calories and macros.</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`photo-calories-${index}`}>Calories</Label>
                        <NumberInput id={`photo-calories-${index}`} decimal value={draft.calories} onChange={(event) => updateDraft(index, "calories", event.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`photo-protein-${index}`}>Protein (g)</Label>
                        <NumberInput id={`photo-protein-${index}`} decimal value={draft.protein} onChange={(event) => updateDraft(index, "protein", event.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`photo-carbs-${index}`}>Carbs (g)</Label>
                        <NumberInput id={`photo-carbs-${index}`} decimal value={draft.carbs} onChange={(event) => updateDraft(index, "carbs", event.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`photo-fat-${index}`}>Fat (g)</Label>
                        <NumberInput id={`photo-fat-${index}`} decimal value={draft.fat} onChange={(event) => updateDraft(index, "fat", event.target.value)} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {totals && (
                <div className="rounded-xl border bg-primary/5 p-3 text-sm">
                  <p className="font-semibold">Confirmed total</p>
                  <p className="mt-1 text-muted-foreground">
                    {Math.round(totals.caloriesKcal)} kcal · P {inputNumber(totals.proteinG)}g · C {inputNumber(totals.carbsG)}g · F {inputNumber(totals.fatG)}g
                  </p>
                </div>
              )}
            </>
          )}

          {(error || scannerDisabledReason) && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
              {error || scannerDisabledReason}
            </div>
          )}
        </div>

        <SheetFooter className="gap-2 sm:flex-row sm:justify-end">
          {analysis ? (
            <>
              <Button type="button" variant="outline" onClick={reset} disabled={saving}>
                <RotateCcw className="size-4" /> Start over
              </Button>
              <Button type="button" onClick={save} disabled={saving || drafts.length === 0}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                {mode === "ingredient"
                  ? "Add ingredients to recipe"
                  : `Add to ${format(dayKeyToDate(dayKey), "MMM d")}`}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="min-w-40 overflow-hidden transition-colors"
                onClick={analyze}
                disabled={
                  !file ||
                  analyzing ||
                  scannerDisabledReason !== null ||
                  usage?.dailyRemaining === 0
                }
              >
                {analyzing ? (
                  <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap">
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    <span>Analyzing…</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap">
                    <Sparkles className="size-4" aria-hidden />
                    <span>Analyze photo</span>
                  </span>
                )}
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
