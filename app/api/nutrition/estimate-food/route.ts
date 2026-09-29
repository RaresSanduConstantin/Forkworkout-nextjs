import { NextResponse } from "next/server";

import {
  AI_FOOD_ESTIMATE_DETAILS_MAX_LENGTH,
  AI_FOOD_ESTIMATE_QUERY_MAX_LENGTH,
  type AIFoodEstimateErrorCode,
} from "@/lib/nutrition/ai-food-estimate";
import {
  OpenAIPhotoError,
  checkAIPhotoRateLimit,
  getAIPhotoServerConfig,
  hasAIPhotoUnlimitedAccess,
  isAIPhotoConfigured,
  requestOpenAIFoodEstimate,
} from "@/lib/nutrition/ai-photo-server";

export const runtime = "nodejs";
export const maxDuration = 30;

const noStoreHeaders = { "Cache-Control": "private, no-store" };
const DEVICE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorResponse(
  error: AIFoodEstimateErrorCode,
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

export async function POST(request: Request) {
  const config = getAIPhotoServerConfig();
  if (!isAIPhotoConfigured(config)) {
    return errorResponse(
      "ESTIMATOR_UNAVAILABLE",
      "AI food estimates are not configured right now. Online search and custom foods still work.",
      503
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 8_192) {
    return errorResponse("INVALID_REQUEST", "The food description is too long.", 413);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_REQUEST", "The food description could not be read.", 400);
  }
  if (!body || typeof body !== "object") {
    return errorResponse("INVALID_REQUEST", "Enter a food to estimate.", 400);
  }

  const input = body as Record<string, unknown>;
  const query = typeof input.query === "string" ? input.query.trim() : "";
  const details = typeof input.details === "string" ? input.details.trim() : "";
  const basisAmount = Number(input.basisAmount);
  const basisUnit = input.basisUnit;
  const anonymousDeviceId = input.anonymousDeviceId;
  if (query.length < 2 || query.length > AI_FOOD_ESTIMATE_QUERY_MAX_LENGTH) {
    return errorResponse(
      "INVALID_REQUEST",
      `Enter a food name between 2 and ${AI_FOOD_ESTIMATE_QUERY_MAX_LENGTH} characters.`,
      400
    );
  }
  if (details.length > AI_FOOD_ESTIMATE_DETAILS_MAX_LENGTH) {
    return errorResponse(
      "INVALID_REQUEST",
      `Keep details under ${AI_FOOD_ESTIMATE_DETAILS_MAX_LENGTH} characters.`,
      400
    );
  }
  if (!Number.isFinite(basisAmount) || basisAmount <= 0 || basisAmount > 10_000) {
    return errorResponse("INVALID_REQUEST", "Enter an amount between 0 and 10,000.", 400);
  }
  if (basisUnit !== "g" && basisUnit !== "ml") {
    return errorResponse("INVALID_REQUEST", "Choose grams or millilitres.", 400);
  }
  if (typeof anonymousDeviceId !== "string" || !DEVICE_ID_PATTERN.test(anonymousDeviceId)) {
    return errorResponse("INVALID_REQUEST", "A valid installation ID is required.", 400);
  }

  try {
    const unlimited = hasAIPhotoUnlimitedAccess({ request, anonymousDeviceId, config });
    if (!unlimited) {
      const rateLimit = await checkAIPhotoRateLimit({ request, anonymousDeviceId, config });
      if (!rateLimit.allowed) {
        return errorResponse(
          "RATE_LIMITED",
          "The daily AI nutrition limit has been reached. Try again later or create a custom food.",
          429,
          rateLimit.retryAfterSeconds
        );
      }
    }

    const estimate = await requestOpenAIFoodEstimate({
      query,
      details: details || undefined,
      basisAmount,
      basisUnit,
      anonymousDeviceId,
      config,
    });
    return NextResponse.json({ estimate }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof OpenAIPhotoError && error.kind === "budget") {
      return errorResponse(
        "MONTHLY_BUDGET_REACHED",
        "AI estimates have reached this month's usage limit. Online search and manual entry still work.",
        503,
        undefined,
        error.providerCode
      );
    }
    if (error instanceof OpenAIPhotoError && error.kind === "billing") {
      return errorResponse(
        "AI_BILLING_UNAVAILABLE",
        "OpenAI API billing or credits are not available for this project.",
        503,
        undefined,
        error.providerCode
      );
    }
    if (error instanceof OpenAIPhotoError && error.kind === "provider_rate_limit") {
      return errorResponse(
        "RATE_LIMITED",
        "OpenAI temporarily rate-limited the estimate. Wait briefly and try again.",
        429,
        error.retryAfterSeconds,
        error.providerCode
      );
    }
    return errorResponse(
      "AI_ESTIMATE_FAILED",
      "The food estimate could not be generated right now. Try online search or add it manually.",
      502
    );
  }
}
