import type { NutritionNutrients } from "@/lib/nutrition/types";
import { sumNutrients } from "@/lib/nutrition/calculations";

export const AI_PHOTO_SUPPORTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const AI_PHOTO_CLIENT_MAX_SOURCE_BYTES = 25 * 1024 * 1024;
export const AI_PHOTO_CLIENT_MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export type AIPhotoConfidence = "low" | "medium" | "high";
export type AIPhotoMode = "food" | "label";

export type AIPhotoFood = {
  name: string;
  estimatedWeightGrams: number;
  nutrients: NutritionNutrients;
  confidence: number;
};

export type AIPhotoAnalysis = {
  foods: AIPhotoFood[];
  total: NutritionNutrients;
  confidence: AIPhotoConfidence;
};

export type AIPhotoUsage = {
  enabled: boolean;
  dailyLimit: number;
  dailyRemaining: number;
  dailyResetAt?: number;
  unlimited: boolean;
};

export type AIPhotoErrorCode =
  | "RATE_LIMITED"
  | "MONTHLY_BUDGET_REACHED"
  | "AI_BILLING_UNAVAILABLE"
  | "INVALID_IMAGE"
  | "AI_ANALYSIS_FAILED"
  | "SCANNER_UNAVAILABLE";

export class AIPhotoAnalysisError extends Error {
  constructor(
    readonly code: AIPhotoErrorCode,
    message: string,
    readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "AIPhotoAnalysisError";
  }
}

export async function fetchAIPhotoUsage(
  anonymousDeviceId: string,
  signal?: AbortSignal
): Promise<AIPhotoUsage> {
  const response = await fetch("/api/nutrition/analyze-photo", {
    method: "GET",
    cache: "no-store",
    headers: { "X-ForkWorkout-Installation-Id": anonymousDeviceId },
    signal,
  });
  const body = (await response.json().catch(() => null)) as
    | {
        enabled?: unknown;
        dailyLimit?: unknown;
        dailyRemaining?: unknown;
        dailyResetAt?: unknown;
        unlimited?: unknown;
      }
    | null;
  const dailyLimit = boundedNumber(body?.dailyLimit, 1_000);
  const dailyRemaining = boundedNumber(body?.dailyRemaining, 1_000);
  const unlimited = body?.unlimited === true;
  if (
    !response.ok ||
    typeof body?.enabled !== "boolean" ||
    !dailyLimit ||
    (!unlimited && dailyRemaining === null)
  ) {
    throw new Error("Daily scan usage is unavailable.");
  }
  const resetAt = boundedNumber(body.dailyResetAt, Number.MAX_SAFE_INTEGER);
  return {
    enabled: body.enabled,
    dailyLimit,
    dailyRemaining: unlimited
      ? dailyLimit
      : Math.min(dailyLimit, dailyRemaining ?? dailyLimit),
    dailyResetAt: resetAt && resetAt > 0 ? resetAt : undefined,
    unlimited,
  };
}

export async function unlockAIPhotoScanning(
  key: string,
  anonymousDeviceId: string
): Promise<void> {
  const response = await fetch("/api/nutrition/analyze-photo/unlock", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, anonymousDeviceId }),
  });
  const body = (await response.json().catch(() => null)) as
    | { message?: unknown }
    | null;
  if (!response.ok) {
    throw new Error(
      typeof body?.message === "string" ? body.message : "Owner scan access could not be unlocked."
    );
  }
}

function boundedNumber(value: unknown, max: number): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= max ? parsed : null;
}

function optionalBoundedNumber(value: unknown, max: number): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return boundedNumber(value, max) ?? undefined;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Validates untrusted model/API output and derives totals from the food rows. */
export function normalizeAIPhotoAnalysis(raw: unknown): AIPhotoAnalysis | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (!Array.isArray(value.foods) || value.foods.length === 0 || value.foods.length > 20) {
    return null;
  }

  const foods: AIPhotoFood[] = [];
  for (const candidate of value.foods) {
    if (!candidate || typeof candidate !== "object") return null;
    const food = candidate as Record<string, unknown>;
    // OpenAI's strict schema returns flat nutrient fields. The API route then
    // normalizes them into the public `nutrients` object before sending them to
    // the browser, so this shared validator must accept both representations.
    const nutrientSource =
      food.nutrients && typeof food.nutrients === "object"
        ? (food.nutrients as Record<string, unknown>)
        : food;
    const name = typeof food.name === "string" ? food.name.trim().slice(0, 160) : "";
    const estimatedWeightGrams = boundedNumber(food.estimatedWeightGrams, 100_000);
    const caloriesKcal = boundedNumber(nutrientSource.caloriesKcal, 100_000);
    const proteinG = boundedNumber(nutrientSource.proteinG, 10_000);
    const carbsG = boundedNumber(nutrientSource.carbsG, 10_000);
    const fatG = boundedNumber(nutrientSource.fatG, 10_000);
    const fibreG = optionalBoundedNumber(nutrientSource.fibreG, 10_000);
    const sugarG = optionalBoundedNumber(nutrientSource.sugarG, 10_000);
    const sodiumMg = optionalBoundedNumber(nutrientSource.sodiumMg, 1_000_000);
    const confidence = boundedNumber(food.confidence, 1);
    if (
      !name ||
      estimatedWeightGrams === null ||
      caloriesKcal === null ||
      proteinG === null ||
      carbsG === null ||
      fatG === null ||
      confidence === null
    ) {
      return null;
    }
    foods.push({
      name,
      estimatedWeightGrams: round(estimatedWeightGrams),
      nutrients: {
        caloriesKcal: round(caloriesKcal),
        proteinG: round(proteinG),
        carbsG: round(carbsG),
        fatG: round(fatG),
        ...(fibreG === undefined ? {} : { fibreG: round(fibreG) }),
        ...(sugarG === undefined ? {} : { sugarG: round(sugarG) }),
        ...(sodiumMg === undefined ? {} : { sodiumMg: Math.round(sodiumMg) }),
      },
      confidence,
    });
  }

  const confidence = value.confidence;
  if (confidence !== "low" && confidence !== "medium" && confidence !== "high") {
    return null;
  }

  const summed = sumNutrients(foods.map((food) => food.nutrients));
  return {
    foods,
    total: {
      caloriesKcal: summed.caloriesKcal,
      proteinG: summed.proteinG,
      carbsG: summed.carbsG,
      fatG: summed.fatG,
      ...(summed.fibreG === undefined ? {} : { fibreG: summed.fibreG }),
      ...(summed.sugarG === undefined ? {} : { sugarG: summed.sugarG }),
      ...(summed.sodiumMg === undefined ? {} : { sodiumMg: summed.sodiumMg }),
    },
    confidence,
  };
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not prepare this image."))),
      "image/jpeg",
      0.82
    );
  });
}

/** Shrinks camera photos before upload to reduce latency, tokens, and spend. */
export async function prepareAIPhoto(file: File): Promise<Blob> {
  if (!AI_PHOTO_SUPPORTED_TYPES.includes(file.type as (typeof AI_PHOTO_SUPPORTED_TYPES)[number])) {
    throw new AIPhotoAnalysisError(
      "INVALID_IMAGE",
      "Choose a JPEG, PNG, or WebP image."
    );
  }
  if (file.size <= 0 || file.size > AI_PHOTO_CLIENT_MAX_SOURCE_BYTES) {
    throw new AIPhotoAnalysisError(
      "INVALID_IMAGE",
      "That image is empty or too large to prepare."
    );
  }

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const maxDimension = 1_600;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare this image.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await canvasBlob(canvas);
    if (blob.size > AI_PHOTO_CLIENT_MAX_UPLOAD_BYTES) {
      throw new AIPhotoAnalysisError(
        "INVALID_IMAGE",
        "The prepared image is still larger than 4 MB. Try a smaller photo."
      );
    }
    return blob;
  } finally {
    bitmap.close();
  }
}

export async function analyzeFoodPhoto({
  image,
  weightGrams,
  anonymousDeviceId,
  signal,
  analysisMode = "food",
}: {
  image: Blob;
  weightGrams?: number;
  anonymousDeviceId: string;
  signal?: AbortSignal;
  analysisMode?: AIPhotoMode;
}): Promise<AIPhotoAnalysis> {
  const form = new FormData();
  form.append("image", image, "food-photo.jpg");
  form.append("anonymousDeviceId", anonymousDeviceId);
  form.append("analysisMode", analysisMode);
  if (weightGrams !== undefined) form.append("weightGrams", String(weightGrams));

  const response = await fetch("/api/nutrition/analyze-photo", {
    method: "POST",
    body: form,
    cache: "no-store",
    signal,
  });
  const body = (await response.json().catch(() => null)) as
    | { error?: unknown; message?: unknown; analysis?: unknown }
    | null;
  if (!response.ok) {
    const code =
      body?.error === "RATE_LIMITED" ||
      body?.error === "MONTHLY_BUDGET_REACHED" ||
      body?.error === "AI_BILLING_UNAVAILABLE" ||
      body?.error === "INVALID_IMAGE" ||
      body?.error === "SCANNER_UNAVAILABLE"
        ? body.error
        : "AI_ANALYSIS_FAILED";
    const retryAfter = Number(response.headers.get("Retry-After"));
    throw new AIPhotoAnalysisError(
      code,
      typeof body?.message === "string" ? body.message : "The food photo could not be analyzed.",
      Number.isFinite(retryAfter) ? retryAfter : undefined
    );
  }
  const analysis = normalizeAIPhotoAnalysis(body?.analysis);
  if (!analysis) {
    throw new AIPhotoAnalysisError(
      "AI_ANALYSIS_FAILED",
      "The analysis response was incomplete. Try another photo."
    );
  }
  return analysis;
}
