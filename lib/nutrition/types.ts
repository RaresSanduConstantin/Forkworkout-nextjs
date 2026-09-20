export const NUTRITION_MEALS = ["breakfast", "lunch", "dinner", "snacks"] as const;

export type NutritionMeal = (typeof NUTRITION_MEALS)[number];

export type NutritionSource =
  | "quick_add"
  | "builtin"
  | "custom"
  | "barcode"
  | "label_ocr"
  | "meal_photo";

export type NutritionNutrients = {
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fibreG?: number;
  sugarG?: number;
  sodiumMg?: number;
};

export type NutritionQuantity = {
  amount: number;
  unit: "g" | "ml" | "serving";
};

/** Immutable food details retained with a log entry for historical accuracy. */
export type NutritionFoodSnapshot = {
  foodId?: string;
  name: string;
  brand?: string;
  variant?: string;
  basisAmount: number;
  basisUnit: "g" | "ml";
  nutrients: NutritionNutrients;
  source: Exclude<NutritionSource, "quick_add" | "meal_photo">;
  sourceReference?: string;
};

export type NutritionFood = {
  id: string;
  name: string;
  aliases: string[];
  variant?: string;
  basisAmount: number;
  basisUnit: "g" | "ml";
  nutrients: NutritionNutrients;
  source: "builtin" | "custom";
  sourceReference?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type NutritionFoodPreference = {
  foodKey: string;
  favourite: boolean;
  useCount: number;
  lastUsedAt?: string;
  updatedAt: string;
};

export type NutritionEntry = {
  id: string;
  dayKey: string;
  meal: NutritionMeal;
  name: string;
  source: NutritionSource;
  /** Nutrients actually consumed, not merely the food's per-100g values. */
  nutrients: NutritionNutrients;
  quantity?: NutritionQuantity;
  foodSnapshot?: NutritionFoodSnapshot;
  createdAt: string;
  updatedAt: string;
};

export type NutritionTargets = {
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  updatedAt: string;
};

/** A deliberate, day-specific choice to add recorded exercise to the food budget. */
export type NutritionDayAdjustment = {
  dayKey: string;
  includeWorkoutCalories: true;
  updatedAt: string;
};

export type NutritionSavedMealItem = Pick<
  NutritionEntry,
  "name" | "source" | "nutrients" | "quantity" | "foodSnapshot"
>;

export type NutritionSavedMeal = {
  id: string;
  name: string;
  items: NutritionSavedMealItem[];
  createdAt: string;
  updatedAt: string;
};

export type NutritionEntryInput = {
  dayKey: string;
  meal: NutritionMeal;
  name: string;
  source?: NutritionSource;
  nutrients: NutritionNutrients;
  quantity?: NutritionQuantity;
  foodSnapshot?: NutritionFoodSnapshot;
};

export type StoredNutritionEntries = {
  version: 1;
  data: NutritionEntry[];
};

export type StoredNutritionTargets = {
  version: 1;
  data: NutritionTargets | null;
};

export type StoredNutritionDayAdjustments = {
  version: 1;
  data: NutritionDayAdjustment[];
};

export type StoredCustomNutritionFoods = {
  version: 1;
  data: NutritionFood[];
};

export type StoredNutritionFoodPreferences = {
  version: 1;
  data: NutritionFoodPreference[];
};

export type StoredNutritionSavedMeals = {
  version: 1;
  data: NutritionSavedMeal[];
};
