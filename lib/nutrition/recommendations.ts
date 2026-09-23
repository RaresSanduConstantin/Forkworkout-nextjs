import { nutrientsForQuantity, sumNutrients } from "@/lib/nutrition/calculations";
import type {
  NutritionMeal,
  NutritionNutrients,
} from "@/lib/nutrition/types";

export type RecommendationCandidateKind = "food" | "saved_meal" | "recipe";

export type RecommendationCandidate = {
  id: string;
  name: string;
  kind: RecommendationCandidateKind;
  baseAmount: number;
  baseUnit: "g" | "ml" | "serving";
  nutrients: NutritionNutrients;
  details?: string;
};

export type RecommendationSelection = {
  candidateId: string;
  multiplier: number;
};

export type MealRecommendation = {
  title: string;
  kind: "snack" | "meal" | "recipe";
  summary: string;
  prepMinutes: number;
  instructions: string[];
  selections: RecommendationSelection[];
  total: NutritionNutrients;
};

export type AIRecommendationUsage = {
  enabled: boolean;
  dailyLimit: number;
  dailyRemaining: number;
  dailyResetAt?: number;
  unlimited: boolean;
};

export type GenerateRecommendationInput = {
  anonymousDeviceId: string;
  remaining: NutritionNutrients;
  meal: NutritionMeal;
  preferences: string;
  pantryFoods: string;
  candidates: RecommendationCandidate[];
};

export type AIRecommendationErrorCode =
  | "RATE_LIMITED"
  | "MONTHLY_BUDGET_REACHED"
  | "AI_BILLING_UNAVAILABLE"
  | "INVALID_REQUEST"
  | "AI_RECOMMENDATION_FAILED"
  | "RECOMMENDATIONS_UNAVAILABLE";

export class AIRecommendationError extends Error {
  constructor(
    readonly code: AIRecommendationErrorCode,
    message: string,
    readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "AIRecommendationError";
  }
}

function boundedNumber(value: unknown, minimum: number, maximum: number): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : null;
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeNutrients(raw: unknown, allowNegative = false): NutritionNutrients | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const minimum = allowNegative ? -100_000 : 0;
  const caloriesKcal = boundedNumber(value.caloriesKcal, minimum, 100_000);
  const proteinG = boundedNumber(value.proteinG, minimum, 10_000);
  const carbsG = boundedNumber(value.carbsG, minimum, 10_000);
  const fatG = boundedNumber(value.fatG, minimum, 10_000);
  if (caloriesKcal === null || proteinG === null || carbsG === null || fatG === null) {
    return null;
  }
  return { caloriesKcal, proteinG, carbsG, fatG };
}

export function normalizeRecommendationCandidate(
  raw: unknown
): RecommendationCandidate | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const id = cleanText(value.id, 120);
  const name = cleanText(value.name, 160);
  const kind = value.kind;
  const baseAmount = boundedNumber(value.baseAmount, 0.01, 100_000);
  const baseUnit = value.baseUnit;
  const nutrients = normalizeNutrients(value.nutrients);
  const details = cleanText(value.details, 500);
  if (
    !/^[a-z0-9:_-]+$/i.test(id) ||
    !name ||
    (kind !== "food" && kind !== "saved_meal" && kind !== "recipe") ||
    baseAmount === null ||
    (baseUnit !== "g" && baseUnit !== "ml" && baseUnit !== "serving") ||
    !nutrients
  ) {
    return null;
  }
  return {
    id,
    name,
    kind,
    baseAmount,
    baseUnit,
    nutrients,
    ...(details ? { details } : {}),
  };
}

export function normalizeRecommendationRemaining(raw: unknown): NutritionNutrients | null {
  return normalizeNutrients(raw, true);
}

/** Validates model/API output and derives every nutrition total from candidates. */
export function normalizeMealRecommendations(
  raw: unknown,
  candidates: RecommendationCandidate[]
): MealRecommendation[] | null {
  if (!raw || typeof raw !== "object") return null;
  const suggestions = (raw as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(suggestions) || suggestions.length === 0 || suggestions.length > 4) {
    return null;
  }
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const result: MealRecommendation[] = [];
  for (const rawSuggestion of suggestions) {
    if (!rawSuggestion || typeof rawSuggestion !== "object") return null;
    const suggestion = rawSuggestion as Record<string, unknown>;
    const title = cleanText(suggestion.title, 120);
    const kind = suggestion.kind;
    const summary = cleanText(suggestion.summary, 300);
    const prepMinutes = boundedNumber(suggestion.prepMinutes, 0, 1_440);
    const rawInstructions = suggestion.instructions;
    const rawSelections = suggestion.selections;
    if (
      !title ||
      !summary ||
      prepMinutes === null ||
      (kind !== "snack" && kind !== "meal" && kind !== "recipe") ||
      !Array.isArray(rawInstructions) ||
      rawInstructions.length > 6 ||
      !Array.isArray(rawSelections) ||
      rawSelections.length === 0 ||
      rawSelections.length > 6
    ) {
      return null;
    }
    const instructions = rawInstructions
      .map((instruction) => cleanText(instruction, 240))
      .filter(Boolean);
    const selections: RecommendationSelection[] = [];
    const seen = new Set<string>();
    for (const rawSelection of rawSelections) {
      if (!rawSelection || typeof rawSelection !== "object") return null;
      const selection = rawSelection as Record<string, unknown>;
      const candidateId = cleanText(selection.candidateId, 120);
      const multiplier = boundedNumber(selection.multiplier, 0.1, 5);
      if (!candidateById.has(candidateId) || multiplier === null || seen.has(candidateId)) {
        return null;
      }
      seen.add(candidateId);
      selections.push({ candidateId, multiplier });
    }
    const total = sumNutrients(
      selections.map((selection) =>
        nutrientsForQuantity(
          candidateById.get(selection.candidateId)!.nutrients,
          selection.multiplier,
          1
        )
      )
    );
    result.push({
      title,
      kind,
      summary,
      prepMinutes: Math.round(prepMinutes),
      instructions,
      selections,
      total,
    });
  }
  return result;
}

export async function fetchAIRecommendationUsage(
  anonymousDeviceId: string,
  signal?: AbortSignal
): Promise<AIRecommendationUsage> {
  const response = await fetch("/api/nutrition/recommendations", {
    method: "GET",
    cache: "no-store",
    headers: { "X-ForkWorkout-Installation-Id": anonymousDeviceId },
    signal,
  });
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const dailyLimit = boundedNumber(body?.dailyLimit, 1, 1_000);
  const dailyRemaining = boundedNumber(body?.dailyRemaining, 0, 1_000);
  const unlimited = body?.unlimited === true;
  if (!response.ok || typeof body?.enabled !== "boolean" || dailyLimit === null) {
    throw new Error("Daily recommendation usage is unavailable.");
  }
  if (!unlimited && dailyRemaining === null) {
    throw new Error("Daily recommendation usage is unavailable.");
  }
  const resetAt = boundedNumber(body?.dailyResetAt, 1, Number.MAX_SAFE_INTEGER);
  return {
    enabled: body.enabled,
    dailyLimit,
    dailyRemaining: unlimited ? dailyLimit : dailyRemaining ?? dailyLimit,
    ...(resetAt === null ? {} : { dailyResetAt: resetAt }),
    unlimited,
  };
}

export async function generateMealRecommendations(
  input: GenerateRecommendationInput,
  signal?: AbortSignal
): Promise<MealRecommendation[]> {
  const response = await fetch("/api/nutrition/recommendations", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  const body = (await response.json().catch(() => null)) as
    | { error?: unknown; message?: unknown; recommendations?: unknown }
    | null;
  if (!response.ok) {
    const code = typeof body?.error === "string"
      ? body.error as AIRecommendationErrorCode
      : "AI_RECOMMENDATION_FAILED";
    throw new AIRecommendationError(
      code,
      typeof body?.message === "string"
        ? body.message
        : "Meal ideas could not be generated right now.",
      Number(response.headers.get("Retry-After")) || undefined
    );
  }
  const normalized = normalizeMealRecommendations(
    { suggestions: body?.recommendations },
    input.candidates
  );
  if (!normalized) {
    throw new AIRecommendationError(
      "AI_RECOMMENDATION_FAILED",
      "The meal ideas response was incomplete. Try again."
    );
  }
  return normalized;
}
