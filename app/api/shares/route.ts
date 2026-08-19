import { NextResponse } from "next/server";

import {
  getShareServerConfig,
  hasQuotaConfiguration,
  hasRedisConfiguration,
} from "@/lib/sharing/config";
import { getShareQuotaStatus } from "@/lib/sharing/quota";
import { checkShareRateLimit } from "@/lib/sharing/rate-limit";
import { getShareStorage } from "@/lib/sharing/server";
import {
  MAX_ENVELOPE_BYTES,
  SHARE_ENVELOPE_VERSION,
  encryptedShareEnvelopeSchema,
  type StoredShare,
} from "@/lib/sharing/types";

const noStoreHeaders = { "Cache-Control": "no-store" };

function unavailable(message = "Cloud sharing is temporarily unavailable.") {
  return NextResponse.json(
    { error: "share_unavailable", message },
    { status: 503, headers: noStoreHeaders }
  );
}

export async function POST(request: Request) {
  const config = getShareServerConfig();
  if (
    !config.enabled ||
    !hasRedisConfiguration(config) ||
    !hasQuotaConfiguration(config)
  ) {
    return unavailable();
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_ENVELOPE_BYTES) {
    return NextResponse.json(
      { error: "payload_too_large", message: "This share is too large." },
      { status: 413, headers: noStoreHeaders }
    );
  }

  const quota = await getShareQuotaStatus(config);
  if (!quota.allowCreates) {
    const message =
      quota.reason === "quota"
        ? "Cloud sharing is paused until the monthly allowance resets."
        : undefined;
    return unavailable(message);
  }

  try {
    const rateLimit = await checkShareRateLimit(request, config, "create");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "rate_limited", message: "Too many share links were created. Try later." },
        {
          status: 429,
          headers: {
            ...noStoreHeaders,
            "Retry-After": String(rateLimit.retryAfterSeconds ?? 60),
          },
        }
      );
    }

    const raw: unknown = await request.json();
    const parsed = encryptedShareEnvelopeSchema.safeParse(
      raw && typeof raw === "object" && "envelope" in raw
        ? (raw as { envelope: unknown }).envelope
        : undefined
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_share", message: "That encrypted share is invalid." },
        { status: 400, headers: noStoreHeaders }
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.ttlSeconds * 1000);
    const record: StoredShare = {
      v: SHARE_ENVELOPE_VERSION,
      envelope: parsed.data,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
    const id = await getShareStorage(config).create(record, config.ttlSeconds);
    return NextResponse.json(
      { id, expiresAt: record.expiresAt },
      { status: 201, headers: noStoreHeaders }
    );
  } catch {
    return unavailable();
  }
}

