"use client";

import * as React from "react";
import {
  BookmarkPlus,
  ChefHat,
  Clock3,
  Loader2,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { nutrientsForQuantity, sumNutrients } from "@/lib/nutrition/calculations";
import {
  filterAndRankNutritionFoods,
  loadNutritionFoods,
} from "@/lib/nutrition/foods";
import {
  AIRecommendationError,
  fetchAIRecommendationUsage,
  generateMealRecommendations,
  type AIRecommendationUsage,
  type MealRecommendation,
  type RecommendationCandidate,
} from "@/lib/nutrition/recommendations";
import type {
  NutritionFood,
  NutritionFoodPreference,
  NutritionMeal,
  NutritionNutrients,
  NutritionSavedMeal,
  NutritionSavedMealItem,
  NutritionTargets,
} from "@/lib/nutrition/types";
import { getAnonymousInstallationId } from "@/lib/storage/anonymous-installation";
import { getNutritionFoodPreferences } from "@/lib/storage/nutrition-food-storage";
import {
  copyNutritionItemsToDay,
  getNutritionSavedMeals,
  saveMealFromItems,
} from "@/lib/storage/nutrition-meal-storage";

const MEAL_LABELS: Record<NutritionMeal, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
};

const number = (value: number) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value);

type CandidateSource = {
  candidate: RecommendationCandidate;
  food?: NutritionFood;
  savedMeal?: NutritionSavedMeal;
};

function remainingNutrients(
  targets: NutritionTargets,
  consumed: NutritionNutrients
): NutritionNutrients {
  return {
    caloriesKcal: Math.round((targets.caloriesKcal - consumed.caloriesKcal) * 10) / 10,
    proteinG: Math.round((targets.proteinG - consumed.proteinG) * 10) / 10,
    carbsG: Math.round((targets.carbsG - consumed.carbsG) * 10) / 10,
    fatG: Math.round((targets.fatG - consumed.fatG) * 10) / 10,
  };
}

function matchScore(total: NutritionNutrients, remaining: NutritionNutrients): number {
  const score = (
    value: number,
    target: number,
    weight: number
  ) => {
    const positiveTarget = Math.max(0, target);
    const denominator = Math.max(positiveTarget, 10);
    const difference = Math.abs(value - positiveTarget) / denominator;
    const overshoot = value > positiveTarget ? (value - positiveTarget) / denominator : 0;
    return weight * (difference + overshoot * 0.75);
  };
  return (
    score(total.caloriesKcal, remaining.caloriesKcal, 0.4) +
    score(total.proteinG, remaining.proteinG, 0.3) +
    score(total.carbsG, remaining.carbsG, 0.15) +
    score(total.fatG, remaining.fatG, 0.15)
  );
}

function localRecommendations(
  sources: CandidateSource[],
  remaining: NutritionNutrients
): MealRecommendation[] {
  if (
    remaining.caloriesKcal <= 0 &&
    remaining.proteinG <= 0 &&
    remaining.carbsG <= 0 &&
    remaining.fatG <= 0
  ) {
    return [];
  }
  const matches = sources.flatMap((source) => {
    const multipliers = source.savedMeal
      ? [0.5, 1, 1.5, 2, 2.5, 3]
      : [0.5, 0.75, 1, 1.25, 1.5, 2];
    return multipliers.map((multiplier) => {
      const total = nutrientsForQuantity(source.candidate.nutrients, multiplier, 1);
      return { source, multiplier, total, score: matchScore(total, remaining) };
    });
  });
  matches.sort((left, right) => left.score - right.score);
  const selected: typeof matches = [];
  const used = new Set<string>();
  for (const match of matches) {
    if (used.has(match.source.candidate.id)) continue;
    used.add(match.source.candidate.id);
    selected.push(match);
    if (selected.length === 4) break;
  }
  return selected.map(({ source, multiplier, total }) => ({
    title: source.candidate.name,
    kind:
      source.candidate.kind === "recipe"
        ? "recipe"
        : source.candidate.kind === "saved_meal"
          ? "meal"
          : "snack",
    summary: source.savedMeal
      ? "A saved option adjusted toward today's remaining targets."
      : "A quick food option adjusted toward today's remaining targets.",
    prepMinutes: 0,
    instructions: [],
    selections: [{ candidateId: source.candidate.id, multiplier }],
    total,
  }));
}

function recommendationItems(
  recommendation: MealRecommendation,
  sourceById: Map<string, CandidateSource>
): NutritionSavedMealItem[] {
  const items: NutritionSavedMealItem[] = [];
  for (const selection of recommendation.selections) {
    const source = sourceById.get(selection.candidateId);
    if (!source) continue;
    if (source.food) {
      const food = source.food;
      const amount = food.basisAmount * selection.multiplier;
      items.push({
        name: food.name,
        source: food.source,
        nutrients: nutrientsForQuantity(food.nutrients, amount, food.basisAmount),
        quantity: { amount, unit: food.basisUnit },
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
      });
      continue;
    }
    if (source.savedMeal) {
      const savedMeal = source.savedMeal;
      const factor =
        savedMeal.kind === "recipe" && savedMeal.servings
          ? selection.multiplier / savedMeal.servings
          : selection.multiplier;
      for (const item of savedMeal.items) {
        items.push({
          ...item,
          nutrients: nutrientsForQuantity(item.nutrients, factor, 1),
          quantity: item.quantity
            ? { ...item.quantity, amount: item.quantity.amount * factor }
            : undefined,
        });
      }
    }
  }
  return items;
}

function LocalRecommendationCard({
  recommendation,
  sourceById,
  onAdd,
}: {
  recommendation: MealRecommendation;
  sourceById: Map<string, CandidateSource>;
  onAdd: () => void;
}) {
  return (
    <article className="space-y-3 rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold">{recommendation.title}</h4>
            <Badge variant="secondary" className="capitalize">
              {recommendation.kind}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{recommendation.summary}</p>
        </div>
        <strong className="shrink-0 text-sm tabular-nums">
          {number(recommendation.total.caloriesKcal)} kcal
        </strong>
      </div>

      <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
        <span className="rounded-full bg-muted px-2 py-1">P {number(recommendation.total.proteinG)}g</span>
        <span className="rounded-full bg-muted px-2 py-1">C {number(recommendation.total.carbsG)}g</span>
        <span className="rounded-full bg-muted px-2 py-1">F {number(recommendation.total.fatG)}g</span>
      </div>

      <ul className="space-y-1 text-xs">
        {recommendation.selections.map((selection) => {
          const source = sourceById.get(selection.candidateId);
          if (!source) return null;
          const amount = source.candidate.baseAmount * selection.multiplier;
          return (
            <li key={selection.candidateId} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">{source.candidate.name}</span>
              <span className="shrink-0 text-muted-foreground">
                {number(amount)} {source.candidate.baseUnit}
                {source.candidate.baseUnit === "serving" && amount !== 1 ? "s" : ""}
              </span>
            </li>
          );
        })}
      </ul>

      {recommendation.instructions.length > 0 && (
        <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
          {recommendation.instructions.map((instruction, index) => (
            <li key={`${instruction}-${index}`}>{instruction}</li>
          ))}
        </ol>
      )}

      <Button type="button" className="w-full" size="sm" onClick={onAdd}>
        Add to meal
      </Button>
    </article>
  );
}

function AIRecommendationCard({
  recommendation,
  onOpen,
}: {
  recommendation: MealRecommendation;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="w-full space-y-3 rounded-xl border bg-card p-3 text-left shadow-sm transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold">{recommendation.title}</h4>
            <Badge variant="secondary" className="capitalize">
              {recommendation.kind}
            </Badge>
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {recommendation.summary}
          </p>
        </div>
        <strong className="shrink-0 text-sm tabular-nums">
          {number(recommendation.total.caloriesKcal)} kcal
        </strong>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock3 className="size-3.5" /> {recommendation.prepMinutes} min
        </span>
        <span className="text-xs font-medium text-primary">View ingredients &amp; steps</span>
      </div>
    </button>
  );
}

export function MealRecommendationsSheet({
  open,
  onOpenChange,
  dayKey,
  initialMeal,
  targets,
  consumed,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayKey: string;
  initialMeal: NutritionMeal;
  targets: NutritionTargets | null;
  consumed: NutritionNutrients;
  onSaved: () => void;
}) {
  const [meal, setMeal] = React.useState<NutritionMeal>(initialMeal);
  const [preferences, setPreferences] = React.useState("");
  const [pantryFoods, setPantryFoods] = React.useState("");
  const [allFoods, setAllFoods] = React.useState<NutritionFood[]>([]);
  const [foodPreferences, setFoodPreferences] = React.useState<NutritionFoodPreference[]>([]);
  const [savedMeals, setSavedMeals] = React.useState<NutritionSavedMeal[]>([]);
  const [loadingFoods, setLoadingFoods] = React.useState(false);
  const [usage, setUsage] = React.useState<AIRecommendationUsage | null>(null);
  const [usageError, setUsageError] = React.useState<string | null>(null);
  const [aiIdeas, setAIIdeas] = React.useState<MealRecommendation[]>([]);
  const [aiSourceById, setAISourceById] = React.useState<Map<string, CandidateSource>>(
    () => new Map()
  );
  const [aiError, setAIError] = React.useState<string | null>(null);
  const [generating, setGenerating] = React.useState(false);
  const [selectedAIIdea, setSelectedAIIdea] = React.useState<MealRecommendation | null>(null);
  const [selectedAIItems, setSelectedAIItems] = React.useState<NutritionSavedMealItem[]>([]);
  const [saveName, setSaveName] = React.useState("");
  const requestControllerRef = React.useRef<AbortController | null>(null);

  const remaining = React.useMemo(
    () => (targets ? remainingNutrients(targets, consumed) : null),
    [consumed, targets]
  );
  const sources = React.useMemo(() => {
    const pantryTerms = pantryFoods
      .split(/[,\n]/)
      .map((term) => term.trim())
      .filter(Boolean)
      .slice(0, 12);
    const pantryMatches = pantryTerms.flatMap((term) =>
      filterAndRankNutritionFoods(allFoods, foodPreferences, term).slice(0, 8)
    );
    const generalMatches = filterAndRankNutritionFoods(allFoods, foodPreferences, "").slice(0, 50);
    const selectedFoods: NutritionFood[] = [];
    const seenFoods = new Set<string>();
    for (const food of [...pantryMatches, ...generalMatches]) {
      const key = `${food.source}:${food.id}`;
      if (seenFoods.has(key) || food.nutrients.caloriesKcal <= 0) continue;
      seenFoods.add(key);
      selectedFoods.push(food);
      if (selectedFoods.length === 50) break;
    }
    const savedSources: CandidateSource[] = savedMeals.slice(0, 24).map((savedMeal) => {
      const divisor =
        savedMeal.kind === "recipe" && savedMeal.servings ? savedMeal.servings : 1;
      return {
        candidate: {
          id: `saved-${savedMeal.id}`,
          name: savedMeal.name,
          kind: savedMeal.kind === "recipe" ? "recipe" : "saved_meal",
          baseAmount: 1,
          baseUnit: "serving",
          nutrients: nutrientsForQuantity(sumNutrients(savedMeal.items), 1, divisor),
          details: savedMeal.items.map((item) => item.name).join(", ").slice(0, 500),
        },
        savedMeal,
      };
    });
    const foodSources: CandidateSource[] = selectedFoods.map((food) => ({
      candidate: {
        id: `food-${allFoods.indexOf(food)}`,
        name: [food.name, food.variant].filter(Boolean).join(" · "),
        kind: "food",
        baseAmount: food.basisAmount,
        baseUnit: food.basisUnit,
        nutrients: food.nutrients,
        details: food.brand,
      },
      food,
    }));
    return [...savedSources, ...foodSources];
  }, [allFoods, foodPreferences, pantryFoods, savedMeals]);
  const sourceById = React.useMemo(
    () => new Map(sources.map((source) => [source.candidate.id, source])),
    [sources]
  );
  const localIdeas = React.useMemo(
    () => (remaining ? localRecommendations(sources, remaining) : []),
    [remaining, sources]
  );

  React.useEffect(() => {
    if (!open) {
      requestControllerRef.current?.abort();
      return;
    }
    setMeal(initialMeal);
    setAIIdeas([]);
    setAISourceById(new Map());
    setAIError(null);
    setSelectedAIIdea(null);
    setLoadingFoods(true);
    setSavedMeals(getNutritionSavedMeals());
    setFoodPreferences(getNutritionFoodPreferences());
    void loadNutritionFoods().then((foods) => {
      setAllFoods(foods);
      setLoadingFoods(false);
    });

    const controller = new AbortController();
    void getAnonymousInstallationId()
      .then((anonymousDeviceId) =>
        fetchAIRecommendationUsage(anonymousDeviceId, controller.signal)
      )
      .then((nextUsage) => {
        setUsage(nextUsage);
        setUsageError(null);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setUsage(null);
          setUsageError("AI idea usage is unavailable right now.");
        }
      });
    return () => controller.abort();
  }, [initialMeal, open]);

  React.useEffect(
    () => () => requestControllerRef.current?.abort(),
    []
  );

  const generateIdeas = async () => {
    if (!remaining || sources.length === 0 || generating) return;
    const anonymousDeviceId = await getAnonymousInstallationId();
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setGenerating(true);
    setAIError(null);
    const requestSourceById = new Map(sourceById);
    try {
      const ideas = await generateMealRecommendations(
        {
          anonymousDeviceId,
          remaining,
          meal,
          preferences,
          pantryFoods,
          candidates: sources.map((source) => source.candidate),
        },
        controller.signal
      );
      setAIIdeas(ideas);
      setAISourceById(requestSourceById);
      setUsage((current) =>
        current && !current.unlimited
          ? { ...current, dailyRemaining: Math.max(0, current.dailyRemaining - 1) }
          : current
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      setAIError(
        error instanceof AIRecommendationError
          ? error.message
          : "Meal ideas could not be generated right now."
      );
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
        setGenerating(false);
      }
    }
  };

  const addRecommendation = (recommendation: MealRecommendation) => {
    const items = recommendationItems(recommendation, sourceById);
    if (items.length === 0) {
      toast.error("Those foods are no longer available.");
      return;
    }
    const result = copyNutritionItemsToDay(items, dayKey, meal, 1, {
      allowDuplicates: true,
    });
    if (!result.saved || result.added === 0) {
      toast.error("Couldn't add that meal idea.");
      return;
    }
    onSaved();
    onOpenChange(false);
    toast.success(`${recommendation.title} added to ${MEAL_LABELS[meal].toLowerCase()}`);
  };

  const openAIIdea = (recommendation: MealRecommendation) => {
    const items = recommendationItems(recommendation, aiSourceById);
    if (items.length === 0) {
      toast.error("Those foods are no longer available.");
      return;
    }
    setSelectedAIIdea(recommendation);
    setSelectedAIItems(items);
    setSaveName(recommendation.title);
  };

  const saveGeneratedIdea = (asRecipe: boolean) => {
    if (!selectedAIIdea || selectedAIItems.length === 0) return;
    const saved = saveMealFromItems(saveName, selectedAIItems, undefined, {
      ...(asRecipe ? { kind: "recipe" as const, servings: 1 } : {}),
      description: selectedAIIdea.summary,
      instructions: selectedAIIdea.instructions,
      prepMinutes: selectedAIIdea.prepMinutes,
    });
    if (!saved) {
      toast.error("Use a unique name before saving this idea.");
      return;
    }
    setSavedMeals(getNutritionSavedMeals());
    onSaved();
    setSelectedAIIdea(null);
    toast.success(`${saved.name} saved as ${asRecipe ? "a recipe" : "a meal"}`);
  };

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto h-[94dvh] max-w-xl overflow-y-auto rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <ChefHat className="size-5 text-primary" /> Meal ideas
          </SheetTitle>
          <SheetDescription>
            Match foods, saved meals, and recipes to what remains today.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-6">
          {!targets || !remaining ? (
            <div className="rounded-xl border border-dashed p-4 text-sm">
              <p className="font-medium">Set nutrition targets first</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Meal ideas need calorie, protein, carb, and fat targets to calculate a useful match.
              </p>
            </div>
          ) : (
            <>
              <section className="rounded-xl border bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Remaining today
                </p>
                <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                  {([
                    ["Calories", remaining.caloriesKcal, "kcal"],
                    ["Protein", remaining.proteinG, "g"],
                    ["Carbs", remaining.carbsG, "g"],
                    ["Fat", remaining.fatG, "g"],
                  ] as const).map(([label, value, unit]) => (
                    <div key={label} className="rounded-lg bg-background p-2">
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                      <p className="mt-0.5 text-xs font-semibold tabular-nums">
                        {number(value)} {unit}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="recommendation-meal">Local matches go to</Label>
                  <Select value={meal} onValueChange={(value) => setMeal(value as NutritionMeal)}>
                    <SelectTrigger id="recommendation-meal" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(MEAL_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="recommendation-preferences">Preferences</Label>
                  <Input
                    id="recommendation-preferences"
                    value={preferences}
                    onChange={(event) => setPreferences(event.target.value.slice(0, 500))}
                    placeholder="e.g. vegetarian, no nuts"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="recommendation-pantry">Foods you have (optional)</Label>
                <Input
                  id="recommendation-pantry"
                  value={pantryFoods}
                  onChange={(event) => setPantryFoods(event.target.value.slice(0, 500))}
                  placeholder="e.g. chicken, rice, eggs, spinach"
                />
                <p className="text-xs text-muted-foreground">
                  AI ideas will prioritize matching foods from the nutrition catalog.
                </p>
              </div>

              <div className="rounded-xl border">
                <Accordion type="single" collapsible>
                  <AccordionItem value="local-matches" className="border-b-0 px-3">
                    <AccordionTrigger className="py-3 hover:no-underline">
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-semibold">
                          Matches from your foods
                          {!loadingFoods && localIdeas.length > 0 && (
                            <Badge variant="secondary">{localIdeas.length}</Badge>
                          )}
                        </span>
                        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                          Calculated locally from saved meals and known nutrition values.
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-2">
                      {loadingFoods ? (
                        <div className="flex items-center gap-2 rounded-xl border p-3 text-sm text-muted-foreground">
                          <Loader2 className="size-4 animate-spin" /> Finding close matches…
                        </div>
                      ) : localIdeas.length > 0 ? (
                        localIdeas.map((idea) => (
                          <LocalRecommendationCard
                            key={`local-${idea.selections[0]?.candidateId}`}
                            recommendation={idea}
                            sourceById={sourceById}
                            onAdd={() => addRecommendation(idea)}
                          />
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
                          Your daily targets are already covered, or there are no matching foods yet.
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>

              <section className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                      <Sparkles className="size-4 text-primary" /> AI combinations
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Uses known foods and recalculates every total in the app.
                    </p>
                  </div>
                  {usage && (
                    <Badge variant="outline" className="shrink-0">
                      {usage.unlimited
                        ? "Owner · unlimited"
                        : `${usage.dailyRemaining}/${usage.dailyLimit} left`}
                    </Badge>
                  )}
                </div>

                {usageError && (
                  <p className="rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
                    {usageError}
                  </p>
                )}
                {aiError && (
                  <p className="rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
                    {aiError}
                  </p>
                )}

                {aiIdeas.length > 0 && (
                  <div className="space-y-2">
                    {aiIdeas.map((idea, index) => (
                      <AIRecommendationCard
                        key={`ai-${idea.title}-${index}`}
                        recommendation={idea}
                        onOpen={() => openAIIdea(idea)}
                      />
                    ))}
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={generateIdeas}
                  disabled={
                    loadingFoods ||
                    generating ||
                    sources.length === 0 ||
                    !usage?.enabled ||
                    (!usage.unlimited && usage.dailyRemaining === 0)
                  }
                >
                  {generating ? (
                    <><Loader2 className="size-4 animate-spin" /> Creating meal ideas…</>
                  ) : (
                    <><WandSparkles className="size-4" /> {aiIdeas.length > 0 ? "Generate new ideas" : "Generate AI ideas"}</>
                  )}
                </Button>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Review ingredients before eating. AI suggestions cannot guarantee allergen safety and are not medical advice.
                </p>
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
    <Dialog
      open={selectedAIIdea !== null}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setSelectedAIIdea(null);
      }}
    >
      <DialogContent
        className="max-h-[90dvh] max-w-lg overflow-y-auto"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        {selectedAIIdea && (
          <>
            <DialogHeader>
              <DialogTitle>{selectedAIIdea.title}</DialogTitle>
              <DialogDescription>{selectedAIIdea.summary}</DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {selectedAIIdea.kind}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Clock3 className="size-3.5" /> {selectedAIIdea.prepMinutes} min
                </Badge>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                {([
                  ["Calories", selectedAIIdea.total.caloriesKcal, "kcal"],
                  ["Protein", selectedAIIdea.total.proteinG, "g"],
                  ["Carbs", selectedAIIdea.total.carbsG, "g"],
                  ["Fat", selectedAIIdea.total.fatG, "g"],
                ] as const).map(([label, value, unit]) => (
                  <div key={label} className="rounded-lg bg-muted p-2">
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                    <p className="mt-0.5 text-xs font-semibold tabular-nums">
                      {number(value)} {unit}
                    </p>
                  </div>
                ))}
              </div>

              <section className="space-y-2">
                <h4 className="text-sm font-semibold">Ingredients</h4>
                <ul className="space-y-2 text-sm">
                  {selectedAIItems.map((item, index) => (
                    <li
                      key={`${item.name}-${index}`}
                      className="flex items-start justify-between gap-3 rounded-lg border p-2.5"
                    >
                      <span>{item.name}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {item.quantity
                          ? `${number(item.quantity.amount)} ${item.quantity.unit}`
                          : `${number(item.nutrients.caloriesKcal)} kcal`}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="space-y-2">
                <h4 className="text-sm font-semibold">How to prepare</h4>
                {selectedAIIdea.instructions.length > 0 ? (
                  <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                    {selectedAIIdea.instructions.map((instruction, index) => (
                      <li key={`${instruction}-${index}`}>{instruction}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Combine or serve the ingredients as preferred.
                  </p>
                )}
              </section>

              <div className="space-y-1.5">
                <Label htmlFor="generated-meal-name">Name</Label>
                <Input
                  id="generated-meal-name"
                  value={saveName}
                  onChange={(event) => setSaveName(event.target.value.slice(0, 120))}
                />
              </div>
            </div>

            <DialogFooter className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" onClick={() => saveGeneratedIdea(false)}>
                <BookmarkPlus className="size-4" /> Save as meal
              </Button>
              <Button type="button" onClick={() => saveGeneratedIdea(true)}>
                <ChefHat className="size-4" /> Save as recipe
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
