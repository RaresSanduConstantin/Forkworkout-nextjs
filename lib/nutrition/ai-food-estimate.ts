import type { NutritionNutrients } from "@/lib/nutrition/types";

export const AI_FOOD_ESTIMATE_QUERY_MAX_LENGTH = 120;
export const AI_FOOD_ESTIMATE_DETAILS_MAX_LENGTH = 400;

export type AIFoodEstimateConfidence = "low" | "medium" | "high";

export type AIFoodEstimate = {
  name: string;
  basisAmount: number;
  basisUnit: "g" | "ml";
  nutrients: NutritionNutrients;
  confidence: AIFoodEstimateConfidence;
};

export type AIFoodEstimateErrorCode =
  | "RATE_LIMITED"
  | "MONTHLY_BUDGET_REACHED"
  | "AI_BILLING_UNAVAILABLE"
  | "INVALID_REQUEST"
  | "AI_ESTIMATE_FAILED"
  | "ESTIMATOR_UNAVAILABLE";

export class AIFoodEstimateError extends Error {
  constructor(
    readonly code: AIFoodEstimateErrorCode,
    message: string,
    readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "AIFoodEstimateError";
  }
}

function boundedNumber(value: unknown, max: number): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= max ? parsed : null;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Validates the untrusted provider/API response before it reaches food storage. */
export function normalizeAIFoodEstimate(raw: unknown): AIFoodEstimate | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const nutrientSource =
    value.nutrients && typeof value.nutrients === "object"
      ? (value.nutrients as Record<string, unknown>)
      : value;
  const name = typeof value.name === "string" ? value.name.trim().slice(0, 160) : "";
  const basisAmount = boundedNumber(value.basisAmount, 10_000);
  const basisUnit = value.basisUnit === "g" || value.basisUnit === "ml" ? value.basisUnit : null;
  const caloriesKcal = boundedNumber(nutrientSource.caloriesKcal, 100_000);
  const proteinG = boundedNumber(nutrientSource.proteinG, 10_000);
  const carbsG = boundedNumber(nutrientSource.carbsG, 10_000);
  const fatG = boundedNumber(nutrientSource.fatG, 10_000);
  const confidence =
    value.confidence === "low" || value.confidence === "medium" || value.confidence === "high"
      ? value.confidence
      : null;

  if (
    !name ||
    basisAmount === null ||
    basisAmount <= 0 ||
    !basisUnit ||
    caloriesKcal === null ||
    proteinG === null ||
    carbsG === null ||
    fatG === null ||
    !confidence
  ) {
    return null;
  }

  return {
    name,
    basisAmount: round(basisAmount),
    basisUnit,
    nutrients: {
      caloriesKcal: round(caloriesKcal),
      proteinG: round(proteinG),
      carbsG: round(carbsG),
      fatG: round(fatG),
    },
    confidence,
  };
}

export async function estimateFoodWithAI(
  input: {
    query: string;
    details?: string;
    basisAmount: number;
    basisUnit: "g" | "ml";
    anonymousDeviceId: string;
  },
  signal?: AbortSignal
): Promise<AIFoodEstimate> {
  const response = await fetch("/api/nutrition/estimate-food", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  const body = (await response.json().catch(() => null)) as
    | {
        estimate?: unknown;
        error?: unknown;
        message?: unknown;
      }
    | null;

  if (!response.ok) {
    const code =
      typeof body?.error === "string"
        ? (body.error as AIFoodEstimateErrorCode)
        : "AI_ESTIMATE_FAILED";
    const retryAfter = Number(response.headers.get("Retry-After"));
    throw new AIFoodEstimateError(
      code,
      typeof body?.message === "string"
        ? body.message
        : "The food estimate could not be generated right now.",
      Number.isFinite(retryAfter) ? retryAfter : undefined
    );
  }

  const estimate = normalizeAIFoodEstimate(body?.estimate);
  if (!estimate) {
    throw new AIFoodEstimateError(
      "AI_ESTIMATE_FAILED",
      "The AI returned incomplete nutrition values. Try adding the food manually."
    );
  }
  return estimate;
}
