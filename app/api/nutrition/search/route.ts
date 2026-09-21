import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import {
  OPEN_FOOD_FACTS_PRODUCT_FIELDS,
  normalizeOpenFoodFactsSearchProduct,
} from "@/lib/nutrition/barcodes";
import type { NutritionFood } from "@/lib/nutrition/types";
import { normalizeUsdaSearchFood } from "@/lib/nutrition/usda";

const MAX_REQUESTS_PER_MINUTE = 10;
const requestBuckets = new Map<string, { count: number; resetAt: number }>();
const noStoreHeaders = { "Cache-Control": "private, no-store" };

function requestIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const value = forwarded || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(value).digest("base64url").slice(0, 22);
}

function allowRequest(request: Request, now = Date.now()): boolean {
  if (requestBuckets.size > 1_000) {
    for (const [key, bucket] of requestBuckets) {
      if (bucket.resetAt <= now) requestBuckets.delete(key);
    }
  }
  const id = requestIdentifier(request);
  const current = requestBuckets.get(id);
  if (!current || current.resetAt <= now) {
    requestBuckets.set(id, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (current.count >= MAX_REQUESTS_PER_MINUTE) return false;
  current.count += 1;
  return true;
}

type SourceStatus = "ok" | "not_configured" | "unavailable";

async function searchUsda(
  query: string,
  apiKey: string,
  signal: AbortSignal
): Promise<NutritionFood[]> {
  const endpoint = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  endpoint.searchParams.set("api_key", apiKey);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query,
      dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)"],
      pageSize: 25,
      requireAllWords: false,
    }),
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error(`USDA search failed with ${response.status}`);
  const body = (await response.json()) as { foods?: unknown };
  return Array.isArray(body.foods)
    ? body.foods
        .map(normalizeUsdaSearchFood)
        .filter((food): food is NutritionFood => food !== null)
    : [];
}

async function searchOpenFoodFacts(
  query: string,
  signal: AbortSignal
): Promise<NutritionFood[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "20",
    fields: OPEN_FOOD_FACTS_PRODUCT_FIELDS,
  });
  const response = await fetch(
    `https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent":
          "ForkWorkout/0.1.0 (https://github.com/RaresSanduConstantin/Forkworkout-nextjs)",
      },
      cache: "no-store",
      signal,
    }
  );
  if (!response.ok) throw new Error(`Open Food Facts search failed with ${response.status}`);
  const body = (await response.json()) as { products?: unknown };
  return Array.isArray(body.products)
    ? body.products
        .map(normalizeOpenFoodFactsSearchProduct)
        .filter((food): food is NutritionFood => food !== null)
    : [];
}

export async function GET(request: Request) {
  if (!allowRequest(request)) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many food searches. Try again in a minute." },
      { status: 429, headers: { ...noStoreHeaders, "Retry-After": "60" } }
    );
  }

  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 120) ?? "";
  if (query.length < 2) {
    return NextResponse.json(
      { error: "invalid_query", message: "Enter at least two characters." },
      { status: 400, headers: noStoreHeaders }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const apiKey = process.env.USDA_FDC_API_KEY?.trim();
    const [usdaResult, openFoodFactsResult] = await Promise.allSettled([
      apiKey
        ? searchUsda(query, apiKey, controller.signal)
        : Promise.resolve<NutritionFood[]>([]),
      searchOpenFoodFacts(query, controller.signal),
    ]);
    const sources: { usda: SourceStatus; openFoodFacts: SourceStatus } = {
      usda: !apiKey
        ? "not_configured"
        : usdaResult.status === "fulfilled"
          ? "ok"
          : "unavailable",
      openFoodFacts:
        openFoodFactsResult.status === "fulfilled" ? "ok" : "unavailable",
    };
    if (sources.usda !== "ok" && sources.openFoodFacts !== "ok") {
      return NextResponse.json(
        { error: "search_unavailable", message: "Online food search is unavailable right now." },
        { status: 502, headers: noStoreHeaders }
      );
    }
    const foods = [
      ...(usdaResult.status === "fulfilled" ? usdaResult.value : []),
      ...(openFoodFactsResult.status === "fulfilled" ? openFoodFactsResult.value : []),
    ];
    return NextResponse.json({ foods, sources }, { headers: noStoreHeaders });
  } catch {
    return NextResponse.json(
      { error: "search_unavailable", message: "Online food search is unavailable right now." },
      { status: 502, headers: noStoreHeaders }
    );
  } finally {
    clearTimeout(timeout);
  }
}
