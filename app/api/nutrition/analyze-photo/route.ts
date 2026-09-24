import { NextResponse } from "next/server";

import {
  AI_PHOTO_DETAILS_MAX_LENGTH,
  AI_PHOTO_SUPPORTED_TYPES,
} from "@/lib/nutrition/ai-photo";
import {
  OpenAIPhotoError,
  checkAIPhotoRateLimit,
  getAIPhotoDailyUsage,
  getAIPhotoServerConfig,
  hasAIPhotoUnlimitedAccess,
  isAIPhotoConfigured,
  requestOpenAIPhotoAnalysis,
} from "@/lib/nutrition/ai-photo-server";

export const runtime = "nodejs";
export const maxDuration = 30;

const noStoreHeaders = { "Cache-Control": "private, no-store" };
const DEVICE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function errorResponse(
  error: "RATE_LIMITED" | "MONTHLY_BUDGET_REACHED" | "AI_BILLING_UNAVAILABLE" | "INVALID_IMAGE" | "AI_ANALYSIS_FAILED" | "SCANNER_UNAVAILABLE",
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
  const config = getAIPhotoServerConfig();
  const anonymousDeviceId = request.headers.get("x-forkworkout-installation-id");
  const unlimited = Boolean(
    anonymousDeviceId &&
      DEVICE_ID_PATTERN.test(anonymousDeviceId) &&
      hasAIPhotoUnlimitedAccess({ request, anonymousDeviceId, config })
  );
  const dailyUsage =
    !unlimited && anonymousDeviceId && DEVICE_ID_PATTERN.test(anonymousDeviceId)
      ? await getAIPhotoDailyUsage({ anonymousDeviceId, config })
      : null;
  return NextResponse.json(
    {
      enabled: isAIPhotoConfigured(config),
      maxImageSizeMb: config.maxImageBytes / 1024 / 1024,
      dailyLimit: dailyUsage?.limit ?? config.deviceDailyLimit,
      dailyRemaining: dailyUsage?.remaining ?? null,
      dailyResetAt: dailyUsage?.resetAt ?? null,
      unlimited,
    },
    { headers: noStoreHeaders }
  );
}

export async function POST(request: Request) {
  const config = getAIPhotoServerConfig();
  if (!isAIPhotoConfigured(config)) {
    return errorResponse(
      "SCANNER_UNAVAILABLE",
      "AI food scanning is not configured right now. Search, barcode scanning, and manual entry still work.",
      503
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > config.maxImageBytes + 256 * 1024
  ) {
    return errorResponse("INVALID_IMAGE", "The image is larger than the upload limit.", 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse("INVALID_IMAGE", "The photo upload could not be read.", 400);
  }

  const image = form.get("image");
  const anonymousDeviceId = form.get("anonymousDeviceId");
  const rawWeight = form.get("weightGrams");
  const rawDetails = form.get("details");
  const rawAnalysisMode = form.get("analysisMode");
  const analysisMode = rawAnalysisMode === "label" ? "label" : "food";
  if (
    rawAnalysisMode !== null &&
    rawAnalysisMode !== "food" &&
    rawAnalysisMode !== "label"
  ) {
    return errorResponse("AI_ANALYSIS_FAILED", "Choose a valid photo analysis mode.", 400);
  }
  if (!(image instanceof File) || image.size <= 0 || image.size > config.maxImageBytes) {
    return errorResponse("INVALID_IMAGE", "Choose an image within the upload limit.", 400);
  }
  if (!AI_PHOTO_SUPPORTED_TYPES.includes(image.type as (typeof AI_PHOTO_SUPPORTED_TYPES)[number])) {
    return errorResponse("INVALID_IMAGE", "Only JPEG, PNG, and WebP images are supported.", 415);
  }
  if (typeof anonymousDeviceId !== "string" || !DEVICE_ID_PATTERN.test(anonymousDeviceId)) {
    return errorResponse("AI_ANALYSIS_FAILED", "A valid installation ID is required.", 400);
  }

  let weightGrams: number | undefined;
  if (typeof rawWeight === "string" && rawWeight.trim()) {
    weightGrams = Number(rawWeight);
    if (!Number.isFinite(weightGrams) || weightGrams <= 0 || weightGrams > 100_000) {
      return errorResponse("AI_ANALYSIS_FAILED", "Enter a weight between 0 and 100,000 grams.", 400);
    }
  }

  let details: string | undefined;
  if (rawDetails !== null) {
    if (typeof rawDetails !== "string") {
      return errorResponse("AI_ANALYSIS_FAILED", "Enter valid meal details.", 400);
    }
    details = rawDetails.trim() || undefined;
    if (details && details.length > AI_PHOTO_DETAILS_MAX_LENGTH) {
      return errorResponse(
        "AI_ANALYSIS_FAILED",
        `Keep meal details under ${AI_PHOTO_DETAILS_MAX_LENGTH} characters.`,
        400
      );
    }
  }

  try {
    const unlimited = hasAIPhotoUnlimitedAccess({ request, anonymousDeviceId, config });
    if (!unlimited) {
      const rateLimit = await checkAIPhotoRateLimit({
        request,
        anonymousDeviceId,
        config,
      });
      if (!rateLimit.allowed) {
        return errorResponse(
          "RATE_LIMITED",
          "The AI scan limit has been reached. Try again later or add food another way.",
          429,
          rateLimit.retryAfterSeconds
        );
      }
    }

    const analysis = await requestOpenAIPhotoAnalysis({
      image: Buffer.from(await image.arrayBuffer()),
      mimeType: image.type,
      weightGrams,
      details,
      anonymousDeviceId,
      config,
      analysisMode,
    });
    return NextResponse.json({ analysis }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof OpenAIPhotoError && error.kind === "budget") {
      return errorResponse(
        "MONTHLY_BUDGET_REACHED",
        "AI food scanning has reached this month's usage limit. You can still search foods, scan barcodes, or add nutrition manually.",
        503,
        undefined,
        error.providerCode
      );
    }
    if (error instanceof OpenAIPhotoError && error.kind === "billing") {
      return errorResponse(
        "AI_BILLING_UNAVAILABLE",
        "OpenAI API billing or credits are not available for this project. Check the API billing balance and confirm the key belongs to the selected project.",
        503,
        undefined,
        error.providerCode
      );
    }
    if (error instanceof OpenAIPhotoError && error.kind === "provider_rate_limit") {
      return errorResponse(
        "RATE_LIMITED",
        "OpenAI temporarily rate-limited the analysis. Wait briefly and try again.",
        429,
        error.retryAfterSeconds,
        error.providerCode
      );
    }
    if (error instanceof OpenAIPhotoError && error.kind === "invalid") {
      return errorResponse(
        "INVALID_IMAGE",
        analysisMode === "label"
          ? "No readable nutrition label was detected. Keep the complete label sharp and well lit."
          : "No food was detected. Try a clearer photo with the full portion visible.",
        422
      );
    }
    return errorResponse(
      "AI_ANALYSIS_FAILED",
      "The photo could not be analyzed right now. Try again or add the food manually.",
      502
    );
  }
}
