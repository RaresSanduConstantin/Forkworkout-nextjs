import { NextResponse } from "next/server";

import {
  AIRecommendationProviderError,
  checkAIRecommendationRateLimit,
  getAIRecommendationDailyUsage,
  getAIRecommendationServerConfig,
  isAIRecommendationConfigured,
  requestOpenAIRecommendations,
} from "@/lib/nutrition/ai-recommendations-server";
import { hasAIPhotoUnlimitedAccess } from "@/lib/nutrition/ai-photo-server";
import {
  normalizeRecommendationCandidate,
  normalizeRecommendationRemaining,
} from "@/lib/nutrition/recommendations";
import { NUTRITION_MEALS, type NutritionMeal } from "@/lib/nutrition/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const noStoreHeaders = { "Cache-Control": "private, no-store" };
const DEVICE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ErrorCode =
  | "RATE_LIMITED"
  | "MONTHLY_BUDGET_REACHED"
  | "AI_BILLING_UNAVAILABLE"
  | "INVALID_REQUEST"
  | "AI_RECOMMENDATION_FAILED"
  | "RECOMMENDATIONS_UNAVAILABLE";

function errorResponse(
  error: ErrorCode,
  message: string,
  status: number,
  retryAfterSeconds?: number,
  reason?: string
) {
  return NextResponse.json(
    { error, message, ...(reason ? { reason } : {}) },
    {
      status,
      headers: {
        ...noStoreHeaders,
        ...(retryAfterSeconds
          ? { "Retry-After": String(Math.max(1, Math.ceil(retryAfterSeconds))) }
          : {}),
      },
    }
  );
}

export async function GET(request: Request) {
  const config = getAIRecommendationServerConfig();
  const anonymousDeviceId = request.headers.get("x-forkworkout-installation-id");
  const validDevice = Boolean(
    anonymousDeviceId && DEVICE_ID_PATTERN.test(anonymousDeviceId)
  );
  const unlimited = Boolean(
    validDevice &&
      anonymousDeviceId &&
      hasAIPhotoUnlimitedAccess({ request, anonymousDeviceId, config })
  );
  const usage =
    !unlimited && validDevice && anonymousDeviceId
      ? await getAIRecommendationDailyUsage({ anonymousDeviceId, config })
      : null;
  return NextResponse.json(
    {
      enabled: isAIRecommendationConfigured(config),
      dailyLimit: usage?.limit ?? config.recommendationDailyLimit,
      dailyRemaining: usage?.remaining ?? null,
      dailyResetAt: usage?.resetAt ?? null,
      unlimited,
    },
    { headers: noStoreHeaders }
  );
}

export async function POST(request: Request) {
  const config = getAIRecommendationServerConfig();
  if (!isAIRecommendationConfigured(config)) {
    return errorResponse(
      "RECOMMENDATIONS_UNAVAILABLE",
      "AI meal ideas are not configured right now. Saved-meal and food matches are still available.",
      503
    );
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 192 * 1024) {
    return errorResponse("INVALID_REQUEST", "The recommendation request is too large.", 413);
  }
  const body = (await request.json().catch(() => null)) as
    | {
        anonymousDeviceId?: unknown;
        remaining?: unknown;
        meal?: unknown;
        preferences?: unknown;
        pantryFoods?: unknown;
        candidates?: unknown;
      }
    | null;
  const anonymousDeviceId =
    typeof body?.anonymousDeviceId === "string" ? body.anonymousDeviceId : "";
  const remaining = normalizeRecommendationRemaining(body?.remaining);
  const meal = body?.meal;
  const preferences =
    typeof body?.preferences === "string" ? body.preferences.trim().slice(0, 500) : "";
  const pantryFoods =
    typeof body?.pantryFoods === "string" ? body.pantryFoods.trim().slice(0, 500) : "";
  const rawCandidates = body?.candidates;
  if (
    !DEVICE_ID_PATTERN.test(anonymousDeviceId) ||
    !remaining ||
    !NUTRITION_MEALS.includes(meal as NutritionMeal) ||
    !Array.isArray(rawCandidates) ||
    rawCandidates.length === 0 ||
    rawCandidates.length > 80
  ) {
    return errorResponse("INVALID_REQUEST", "The meal idea request is invalid.", 400);
  }
  const candidates = rawCandidates
    .map(normalizeRecommendationCandidate)
    .filter((candidate) => candidate !== null);
  if (candidates.length !== rawCandidates.length) {
    return errorResponse("INVALID_REQUEST", "One or more food candidates are invalid.", 400);
  }
  if (new Set(candidates.map((candidate) => candidate.id)).size !== candidates.length) {
    return errorResponse("INVALID_REQUEST", "Food candidate IDs must be unique.", 400);
  }

  try {
    const unlimited = hasAIPhotoUnlimitedAccess({
      request,
      anonymousDeviceId,
      config,
    });
    if (!unlimited) {
      const rateLimit = await checkAIRecommendationRateLimit({
        request,
        anonymousDeviceId,
        config,
      });
      if (!rateLimit.allowed) {
        return errorResponse(
          "RATE_LIMITED",
          "Today's AI meal-idea limit has been reached. Local food and saved-meal matches still work.",
          429,
          rateLimit.retryAfterSeconds
        );
      }
    }
    const recommendations = await requestOpenAIRecommendations({
      remaining,
      meal: meal as NutritionMeal,
      preferences,
      pantryFoods,
      candidates,
      anonymousDeviceId,
      config,
    });
    return NextResponse.json({ recommendations }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof AIRecommendationProviderError && error.kind === "budget") {
      return errorResponse(
        "MONTHLY_BUDGET_REACHED",
        "AI meal ideas have reached this month's usage limit. Local matches remain available.",
        503,
        undefined,
        error.providerCode
      );
    }
    if (error instanceof AIRecommendationProviderError && error.kind === "billing") {
      return errorResponse(
        "AI_BILLING_UNAVAILABLE",
        "OpenAI API billing or credits are not available for this project.",
        503,
        undefined,
        error.providerCode
      );
    }
    if (
      error instanceof AIRecommendationProviderError &&
      error.kind === "provider_rate_limit"
    ) {
      return errorResponse(
        "RATE_LIMITED",
        "OpenAI temporarily rate-limited meal ideas. Wait briefly and try again.",
        429,
        error.retryAfterSeconds,
        error.providerCode
      );
    }
    return errorResponse(
      "AI_RECOMMENDATION_FAILED",
      "Meal ideas could not be generated right now. Try again later.",
      502
    );
  }
}
