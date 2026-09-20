import type { NutritionFood, NutritionNutrients } from "./types";

const OPEN_FOOD_FACTS_PRODUCT_FIELDS = [
  "code",
  "product_name",
  "product_name_en",
  "product_name_ro",
  "generic_name",
  "brands",
  "nutrition_data_per",
  "nutriments",
].join(",");

export type BarcodeProductDraft = {
  barcode: string;
  name: string;
  brand: string;
  basisUnit: "g" | "ml";
  caloriesKcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  fibreG?: number;
  sugarG?: number;
  sodiumMg?: number;
  sourceReference?: string;
};

function finiteNonNegative(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeBarcode(value: string): string {
  return value.replace(/[\s-]/g, "").replace(/\D/g, "").slice(0, 14);
}

function hasValidGtinCheckDigit(barcode: string): boolean {
  const digits = barcode.split("").map(Number);
  const checkDigit = digits.pop();
  if (checkDigit === undefined) return false;
  const sum = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === checkDigit;
}

function expandUpce(barcode: string): string | null {
  if (barcode.length !== 8 || (barcode[0] !== "0" && barcode[0] !== "1")) return null;
  const data = barcode.slice(1, 7);
  const last = data[5];
  let body: string;
  if (last === "0" || last === "1" || last === "2") {
    body = `${barcode[0]}${data.slice(0, 2)}${last}0000${data.slice(2, 5)}`;
  } else if (last === "3") {
    body = `${barcode[0]}${data.slice(0, 3)}00000${data.slice(3, 5)}`;
  } else if (last === "4") {
    body = `${barcode[0]}${data.slice(0, 4)}00000${data[4]}`;
  } else {
    body = `${barcode[0]}${data.slice(0, 5)}0000${last}`;
  }
  return `${body}${barcode[7]}`;
}

/** Validates EAN-8, UPC-E, UPC-A, EAN-13, and GTIN-14 check digits. */
export function isValidGtin(value: string): boolean {
  const barcode = normalizeBarcode(value);
  if (![8, 12, 13, 14].includes(barcode.length) || /^0+$/.test(barcode)) return false;
  if (hasValidGtinCheckDigit(barcode)) return true;
  const expandedUpce = expandUpce(barcode);
  return expandedUpce ? hasValidGtinCheckDigit(expandedUpce) : false;
}

export function barcodeLookupCandidates(value: string): string[] {
  const barcode = normalizeBarcode(value);
  const expandedUpce = expandUpce(barcode);
  return Array.from(
    new Set(
      [barcode, expandedUpce].filter(
        (candidate): candidate is string =>
          candidate !== null && isValidGtin(candidate)
      )
    )
  );
}

export function normalizeOpenFoodFactsProduct(
  raw: unknown,
  requestedBarcode: string
): BarcodeProductDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const response = raw as Record<string, unknown>;
  if (!response.product || typeof response.product !== "object") return null;
  const product = response.product as Record<string, unknown>;
  const nutriments =
    product.nutriments && typeof product.nutriments === "object"
      ? (product.nutriments as Record<string, unknown>)
      : {};
  const barcode = normalizeBarcode(text(product.code) || requestedBarcode);
  if (!isValidGtin(barcode)) return null;

  const caloriesKcal =
    finiteNonNegative(nutriments["energy-kcal_100g"]) ??
    (() => {
      const energyKj = finiteNonNegative(nutriments.energy_100g);
      return energyKj === undefined ? undefined : energyKj / 4.184;
    })();
  const sodiumG = finiteNonNegative(nutriments.sodium_100g);
  const nutritionBasis = text(product.nutrition_data_per).toLocaleLowerCase();

  return {
    barcode,
    name:
      text(product.product_name) ||
      text(product.product_name_en) ||
      text(product.product_name_ro) ||
      text(product.generic_name),
    brand: text(product.brands),
    basisUnit: nutritionBasis.includes("ml") ? "ml" : "g",
    caloriesKcal,
    proteinG: finiteNonNegative(nutriments.proteins_100g),
    carbsG: finiteNonNegative(nutriments.carbohydrates_100g),
    fatG: finiteNonNegative(nutriments.fat_100g),
    fibreG: finiteNonNegative(nutriments.fiber_100g),
    sugarG: finiteNonNegative(nutriments.sugars_100g),
    sodiumMg: sodiumG === undefined ? undefined : sodiumG * 1000,
    sourceReference: `https://world.openfoodfacts.org/product/${barcode}`,
  };
}

export async function fetchOpenFoodFactsProduct(
  barcode: string,
  signal?: AbortSignal
): Promise<BarcodeProductDraft | null> {
  const normalized = normalizeBarcode(barcode);
  if (!isValidGtin(normalized)) throw new Error("Enter a valid EAN or UPC barcode.");
  for (const candidate of barcodeLookupCandidates(normalized)) {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v3/product/${candidate}.json?fields=${OPEN_FOOD_FACTS_PRODUCT_FIELDS}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-User-Agent":
            "ForkWorkout/0.1.0 (https://github.com/RaresSanduConstantin/Forkworkout-nextjs)",
        },
        signal,
      }
    );
    if (response.status === 404) continue;
    if (!response.ok) throw new Error("Open Food Facts is unavailable right now.");
    const product = normalizeOpenFoodFactsProduct(await response.json(), candidate);
    if (product) return product;
  }
  return null;
}

export function barcodeDraftToFood(
  draft: BarcodeProductDraft,
  nutrients: NutritionNutrients
): NutritionFood {
  const now = new Date().toISOString();
  return {
    id: draft.barcode,
    name: draft.name.trim(),
    aliases: draft.brand.trim() ? [draft.brand.trim()] : [],
    brand: draft.brand.trim() || undefined,
    basisAmount: 100,
    basisUnit: draft.basisUnit,
    nutrients,
    source: "barcode",
    sourceReference: draft.sourceReference,
    createdAt: now,
    updatedAt: now,
  };
}
