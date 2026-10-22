"use client";

import * as React from "react";
import { Apple, ChefHat, Pencil, Plus, Search, Star } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { sumNutrients } from "@/lib/nutrition/calculations";
import { filterAndRankNutritionFoods, normalizeFoodSearchText, refreshNutritionFoods } from "@/lib/nutrition/foods";
import { nutritionLibraryFoods } from "@/lib/nutrition/library";
import type { NutritionEntry, NutritionFood, NutritionFoodPreference, NutritionSavedMeal } from "@/lib/nutrition/types";
import { getNutritionFoodPreferences, nutritionFoodKey, setNutritionFoodFavourite } from "@/lib/storage/nutrition-food-storage";
import { getNutritionSavedMeals, setNutritionSavedMealFavourite } from "@/lib/storage/nutrition-meal-storage";
import { cn } from "@/lib/utils";

export type NutritionLibraryTab = "recipes" | "products" | "favourites";

export function NutritionLibrary({ tab, entries, revision, onEditMeal, onEditFood, onCreateRecipe, onCreateFood }: {
  tab: NutritionLibraryTab;
  entries: NutritionEntry[];
  revision: number;
  onEditMeal: (meal: NutritionSavedMeal) => void;
  onEditFood: (food: NutritionFood) => void;
  onCreateRecipe: () => void;
  onCreateFood: () => void;
}) {
  const [foods, setFoods] = React.useState<NutritionFood[]>([]);
  const [meals, setMeals] = React.useState<NutritionSavedMeal[]>([]);
  const [preferences, setPreferences] = React.useState<NutritionFoodPreference[]>([]);
  const [query, setQuery] = React.useState("");
  const [loaded, setLoaded] = React.useState(false);
  const [limit, setLimit] = React.useState(40);

  React.useEffect(() => {
    let active = true;
    setMeals(getNutritionSavedMeals());
    setPreferences(getNutritionFoodPreferences());
    void refreshNutritionFoods().then((catalog) => {
      if (!active) return;
      setFoods(catalog);
      setLoaded(true);
    });
    return () => { active = false; };
  }, [revision]);
  React.useEffect(() => setLimit(40), [query, tab]);

  const preferenceByKey = React.useMemo(() => new Map(preferences.map((preference) => [preference.foodKey, preference])), [preferences]);
  const personalFoods = React.useMemo(() => nutritionLibraryFoods(foods, entries, preferences), [foods, entries, preferences]);
  const visibleFoods = React.useMemo(() => filterAndRankNutritionFoods(personalFoods, preferences, query).filter((food) => tab !== "favourites" || preferenceByKey.get(nutritionFoodKey(food))?.favourite), [personalFoods, preferences, query, tab, preferenceByKey]);
  const visibleMeals = React.useMemo(() => {
    const terms = normalizeFoodSearchText(query).split(" ").filter(Boolean);
    return meals.filter((meal) => {
      if (tab === "favourites" && !meal.favourite) return false;
      const text = normalizeFoodSearchText([meal.name, meal.description, ...meal.items.map((item) => item.name)].filter(Boolean).join(" "));
      return terms.every((term) => text.includes(term));
    });
  }, [meals, query, tab]);

  const toggleFood = (food: NutritionFood) => {
    const key = nutritionFoodKey(food);
    if (!setNutritionFoodFavourite(key, !preferenceByKey.get(key)?.favourite)) {
      toast.error("Couldn't update favourites.");
      return;
    }
    setPreferences(getNutritionFoodPreferences());
  };
  const toggleMeal = (meal: NutritionSavedMeal) => {
    if (!setNutritionSavedMealFavourite(meal.id, !meal.favourite)) {
      toast.error("Couldn't update favourites.");
      return;
    }
    setMeals(getNutritionSavedMeals());
  };
  const star = (name: string, favourite: boolean, onClick: () => void) => (
    <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label={`${favourite ? "Remove" : "Add"} ${name} ${favourite ? "from" : "to"} favourites`} aria-pressed={favourite} onClick={onClick}>
      <Star className={cn("size-5", favourite && "fill-amber-400 text-amber-600 dark:text-amber-400")} />
    </Button>
  );
  const showMeals = tab !== "products";
  const showFoods = tab !== "recipes";
  const count = (showMeals ? visibleMeals.length : 0) + (showFoods ? visibleFoods.length : 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{tab === "recipes" ? "My recipes & meals" : tab === "products" ? "My food products" : "My favourites"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{tab === "recipes" ? "Edit your saved recipes and reusable meals, or star the ones you love." : tab === "products" ? "Foods you’ve used, created, or saved on this device. Edits apply to future use." : "Your starred recipes, meals, and products in one place."}</p>
        </div>
        {tab !== "favourites" && <Button type="button" variant="outline" className="min-h-11" onClick={tab === "recipes" ? onCreateRecipe : onCreateFood}><Plus className="size-4" />{tab === "recipes" ? "New recipe" : "New product"}</Button>}
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 pl-9" placeholder="Search your library…" aria-label="Search nutrition library" />
      </div>
      {!loaded ? <p className="py-8 text-center text-sm text-muted-foreground" role="status">Loading your library…</p> : count === 0 ? (
        <EmptyState icon={tab === "favourites" ? <Star className="size-8" /> : <Apple className="size-8" />} title={query ? "No matches" : tab === "favourites" ? "No favourites yet" : tab === "recipes" ? "No saved recipes yet" : "No food products yet"} description={query ? "Try a different name or ingredient." : tab === "favourites" ? "Tap a star in Recipes or Products to keep your favourites here." : tab === "recipes" ? "Create a recipe to reuse it whenever you eat it." : "Products appear here when you add food to your daily log. You can also create your own."} action={query ? <Button type="button" variant="outline" onClick={() => setQuery("")}>Clear search</Button> : undefined} />
      ) : (
        <>
          {showMeals && visibleMeals.length > 0 && <section className="space-y-2" aria-label="Saved recipes and meals">
            {tab === "favourites" && <h3 className="text-sm font-semibold">Recipes & meals</h3>}
            <ul className="space-y-2">{visibleMeals.slice(0, limit).map((meal) => {
              const totals = sumNutrients(meal.items);
              return <li key={meal.id}><Card className="py-0"><CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1"><p className="break-words font-medium">{meal.name}</p><Badge variant="secondary"><ChefHat className="mr-1 size-3" />{meal.kind === "recipe" ? "Recipe" : "Saved meal"}</Badge><p className="text-xs text-muted-foreground">{meal.items.length} ingredients · {Math.round(totals.caloriesKcal / (meal.kind === "recipe" ? meal.servings ?? 1 : 1))} kcal {meal.kind === "recipe" ? "per serving" : "per meal"}</p></div>
                  {star(meal.name, Boolean(meal.favourite), () => toggleMeal(meal))}
                </div>
                <Button type="button" variant="outline" className="mt-3 min-h-11 w-full" onClick={() => onEditMeal(meal)}><Pencil className="size-4" />Edit {meal.kind === "recipe" ? "recipe" : "meal"}</Button>
              </CardContent></Card></li>;
            })}</ul>
          </section>}
          {showFoods && visibleFoods.length > 0 && <section className="space-y-2" aria-label="Food products">
            {tab === "favourites" && <h3 className="text-sm font-semibold">Products</h3>}
            <ul className="space-y-2">{visibleFoods.slice(0, limit).map((food) => {
              const key = nutritionFoodKey(food);
              return <li key={key}><Card className="py-0"><CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1"><p className="break-words font-medium">{food.name}{food.variant ? ` · ${food.variant}` : ""}</p>{food.brand && <p className="break-words text-xs text-muted-foreground">{food.brand}</p>}<p className="text-xs text-muted-foreground">{Math.round(food.nutrients.caloriesKcal)} kcal per {food.basisAmount} {food.basisUnit}</p></div>
                  {star(food.name, Boolean(preferenceByKey.get(key)?.favourite), () => toggleFood(food))}
                </div>
                <Button type="button" variant="outline" className="mt-3 min-h-11 w-full" onClick={() => onEditFood(food)}><Pencil className="size-4" />{food.source === "builtin" ? "Customize product" : "Edit product"}</Button>
              </CardContent></Card></li>;
            })}</ul>
          </section>}
          {((showMeals && visibleMeals.length > limit) || (showFoods && visibleFoods.length > limit)) && <Button type="button" variant="outline" className="w-full" onClick={() => setLimit((current) => current + 40)}>Show more</Button>}
        </>
      )}
    </div>
  );
}
