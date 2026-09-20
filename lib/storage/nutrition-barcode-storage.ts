import type {
  NutritionFood,
  StoredNutritionBarcodeProducts,
} from "@/lib/nutrition/types";
import {
  barcodeLookupCandidates,
  isValidGtin,
  normalizeBarcode,
} from "@/lib/nutrition/barcodes";
import { STORAGE_KEYS } from "./keys";
import { normalizeNutritionFood } from "./nutrition-food-storage";
import { readJson, writeJson } from "./safe-storage";

export const MAX_CACHED_BARCODE_PRODUCTS = 100;

export function getCachedNutritionBarcodeProducts(): NutritionFood[] {
  const stored = readJson<unknown>(STORAGE_KEYS.nutritionBarcodeProducts, null);
  const raw =
    stored &&
    typeof stored === "object" &&
    Array.isArray((stored as StoredNutritionBarcodeProducts).data)
      ? (stored as StoredNutritionBarcodeProducts).data
      : Array.isArray(stored)
        ? stored
        : [];
  const unique = new Map<string, NutritionFood>();
  for (const candidate of raw) {
    const product = normalizeNutritionFood(candidate, "barcode");
    const barcode = product ? normalizeBarcode(product.id) : "";
    if (!product || !isValidGtin(barcode)) continue;
    const normalizedProduct = { ...product, id: barcode };
    const existing = unique.get(barcode);
    if (!existing || (product.updatedAt ?? "") > (existing.updatedAt ?? "")) {
      unique.set(barcode, normalizedProduct);
    }
  }
  return Array.from(unique.values())
    .sort((left, right) => (right.updatedAt ?? "").localeCompare(left.updatedAt ?? ""))
    .slice(0, MAX_CACHED_BARCODE_PRODUCTS);
}

export function saveCachedNutritionBarcodeProducts(products: NutritionFood[]): boolean {
  const unique = new Map<string, NutritionFood>();
  for (const candidate of products) {
    const product = normalizeNutritionFood(candidate, "barcode");
    const barcode = product ? normalizeBarcode(product.id) : "";
    if (product && isValidGtin(barcode)) unique.set(barcode, { ...product, id: barcode });
  }
  const data = Array.from(unique.values())
    .sort((left, right) => (right.updatedAt ?? "").localeCompare(left.updatedAt ?? ""))
    .slice(0, MAX_CACHED_BARCODE_PRODUCTS);
  return writeJson<StoredNutritionBarcodeProducts>(STORAGE_KEYS.nutritionBarcodeProducts, {
    version: 1,
    data,
  });
}

export function getCachedNutritionBarcodeProduct(barcode: string): NutritionFood | null {
  const candidates = new Set(barcodeLookupCandidates(barcode));
  return getCachedNutritionBarcodeProducts().find((product) => candidates.has(product.id)) ?? null;
}

export function cacheNutritionBarcodeProduct(product: NutritionFood): NutritionFood | null {
  const normalized = normalizeNutritionFood(product, "barcode");
  const barcode = normalized ? normalizeBarcode(normalized.id) : "";
  if (!normalized || !isValidGtin(barcode)) return null;
  normalized.id = barcode;
  const products = getCachedNutritionBarcodeProducts();
  const existing = products.find((candidate) => candidate.id === normalized.id);
  const now = new Date().toISOString();
  const cached = {
    ...normalized,
    createdAt: existing?.createdAt ?? normalized.createdAt ?? now,
    updatedAt: now,
  };
  return saveCachedNutritionBarcodeProducts([
    cached,
    ...products.filter((candidate) => candidate.id !== cached.id),
  ])
    ? cached
    : null;
}
