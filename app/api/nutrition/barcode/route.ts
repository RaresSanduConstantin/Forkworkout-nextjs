import { NextResponse } from "next/server";

import {
  OPEN_FOOD_FACTS_PRODUCT_FIELDS,
  barcodeLookupCandidates,
  isValidGtin,
  normalizeBarcode,
  normalizeOpenFoodFactsProduct,
} from "@/lib/nutrition/barcodes";

const FOUND_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
};
const NOT_FOUND_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
};
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const barcode = normalizeBarcode(
    new URL(request.url).searchParams.get("code") ?? ""
  );
  if (!isValidGtin(barcode)) {
    return NextResponse.json(
      { error: "invalid_barcode", message: "Enter a valid EAN or UPC barcode." },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const timeoutController = new AbortController();
  const abortUpstream = () => timeoutController.abort();
  const timeout = setTimeout(abortUpstream, 10_000);
  request.signal.addEventListener("abort", abortUpstream, { once: true });

  try {
    for (const candidate of barcodeLookupCandidates(barcode)) {
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${candidate}.json?fields=${OPEN_FOOD_FACTS_PRODUCT_FIELDS}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent":
              "ForkWorkout/0.1.0 (https://github.com/RaresSanduConstantin/Forkworkout-nextjs)",
          },
          next: { revalidate: 86_400 },
          signal: timeoutController.signal,
        }
      );
      if (response.status === 404) continue;
      if (!response.ok) {
        return NextResponse.json(
          {
            error: "lookup_unavailable",
            message: "Open Food Facts is unavailable right now.",
          },
          { status: 502, headers: NO_STORE_HEADERS }
        );
      }

      const body: unknown = await response.json();
      if (!normalizeOpenFoodFactsProduct(body, candidate)) continue;
      return NextResponse.json(body, { headers: FOUND_CACHE_HEADERS });
    }

    return NextResponse.json(
      { error: "product_not_found", message: "Product not found." },
      { status: 404, headers: NOT_FOUND_CACHE_HEADERS }
    );
  } catch {
    return NextResponse.json(
      {
        error: "lookup_unavailable",
        message: "Open Food Facts is unavailable right now.",
      },
      { status: 502, headers: NO_STORE_HEADERS }
    );
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abortUpstream);
  }
}
