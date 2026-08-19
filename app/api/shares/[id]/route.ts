import { NextResponse } from "next/server";

import {
  getShareServerConfig,
  hasRedisConfiguration,
} from "@/lib/sharing/config";
import { checkShareRateLimit } from "@/lib/sharing/rate-limit";
import { getShareStorage } from "@/lib/sharing/server";
import { SHORT_SHARE_ID_PATTERN } from "@/lib/sharing/types";

const noStoreHeaders = { "Cache-Control": "private, no-store" };

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const config = getShareServerConfig();
  if (!config.enabled || !hasRedisConfiguration(config)) {
    return NextResponse.json(
      { error: "share_unavailable", message: "Cloud sharing is temporarily unavailable." },
      { status: 503, headers: noStoreHeaders }
    );
  }

  const { id } = await context.params;
  if (!SHORT_SHARE_ID_PATTERN.test(id)) {
    return NextResponse.json(
      { error: "share_not_found", message: "This share does not exist or has expired." },
      { status: 404, headers: noStoreHeaders }
    );
  }

  try {
    const rateLimit = await checkShareRateLimit(request, config, "read");
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "rate_limited", message: "Too many requests. Try again shortly." },
        {
          status: 429,
          headers: {
            ...noStoreHeaders,
            "Retry-After": String(rateLimit.retryAfterSeconds ?? 60),
          },
        }
      );
    }

    const record = await getShareStorage(config).get(id);
    if (!record || Date.parse(record.expiresAt) <= Date.now()) {
      return NextResponse.json(
        { error: "share_not_found", message: "This share does not exist or has expired." },
        { status: 404, headers: noStoreHeaders }
      );
    }
    return NextResponse.json(
      { envelope: record.envelope, expiresAt: record.expiresAt },
      { headers: noStoreHeaders }
    );
  } catch {
    return NextResponse.json(
      { error: "share_unavailable", message: "Cloud sharing is temporarily unavailable." },
      { status: 503, headers: noStoreHeaders }
    );
  }
}

