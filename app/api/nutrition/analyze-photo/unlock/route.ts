import { NextResponse } from "next/server";

import {
  AI_PHOTO_UNLIMITED_COOKIE,
  AI_PHOTO_UNLIMITED_COOKIE_MAX_AGE,
  checkAIPhotoUnlockAttempt,
  createAIPhotoUnlimitedToken,
  getAIPhotoServerConfig,
  matchesAIPhotoUnlimitedKey,
} from "@/lib/nutrition/ai-photo-server";

export const runtime = "nodejs";

const DEVICE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const noStoreHeaders = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const config = getAIPhotoServerConfig();
  if (!config.unlimitedUnlockKey) {
    return NextResponse.json(
      { message: "Owner scan access is not configured." },
      { status: 404, headers: noStoreHeaders }
    );
  }

  const attempt = await checkAIPhotoUnlockAttempt({ request, config });
  if (!attempt.allowed) {
    return NextResponse.json(
      { message: "Too many unlock attempts. Try again later." },
      {
        status: 429,
        headers: {
          ...noStoreHeaders,
          "Retry-After": String(attempt.retryAfterSeconds ?? 3600),
        },
      }
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { key?: unknown; anonymousDeviceId?: unknown }
    | null;
  const key = typeof body?.key === "string" ? body.key : "";
  const anonymousDeviceId =
    typeof body?.anonymousDeviceId === "string" ? body.anonymousDeviceId : "";
  if (
    !DEVICE_ID_PATTERN.test(anonymousDeviceId) ||
    key.length > 512 ||
    !matchesAIPhotoUnlimitedKey(key, config)
  ) {
    return NextResponse.json(
      { message: "That owner key is not valid." },
      { status: 401, headers: noStoreHeaders }
    );
  }

  const token = createAIPhotoUnlimitedToken(anonymousDeviceId, config);
  if (!token) {
    return NextResponse.json(
      { message: "Owner scan access is not configured." },
      { status: 404, headers: noStoreHeaders }
    );
  }

  const response = NextResponse.json(
    { unlocked: true },
    { headers: noStoreHeaders }
  );
  response.cookies.set(AI_PHOTO_UNLIMITED_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/api/nutrition/analyze-photo",
    maxAge: AI_PHOTO_UNLIMITED_COOKIE_MAX_AGE,
  });
  return response;
}
