export type SharedImportReference = {
  kind: "workout" | "program" | "nutrition-meal";
  encoded: string;
};

function extractDirect(value: string): SharedImportReference | null {
  const nutritionMealMatch = value.match(/(?:#|&)importMeal=([^&\s]+)/);
  if (nutritionMealMatch) {
    return { kind: "nutrition-meal", encoded: nutritionMealMatch[1] };
  }
  const programMatch = value.match(/(?:#|&)importProgram=([^&\s]+)/);
  if (programMatch) return { kind: "program", encoded: programMatch[1] };

  const workoutMatch = value.match(/(?:#|&)import=([^&\s]+)/);
  if (workoutMatch) return { kind: "workout", encoded: workoutMatch[1] };
  return null;
}

/** Finds a ForkWorkout import payload in a URL, message, or encoded share-target value. */
export function extractSharedImport(value: string | null | undefined): SharedImportReference | null {
  const input = value?.trim();
  if (!input) return null;

  const direct = extractDirect(input);
  if (direct) return direct;

  // Some operating-system share targets pass the complete URL as encoded text.
  try {
    const decoded = decodeURIComponent(input);
    return decoded === input ? null : extractDirect(decoded);
  } catch {
    return null;
  }
}

/** Rebuilds a clean, copyable app link from an extracted import payload. */
export function buildSharedImportUrl(
  reference: SharedImportReference,
  origin: string
): string {
  if (reference.kind === "nutrition-meal") {
    return `${origin.replace(/\/$/, "")}/nutrition#importMeal=${reference.encoded}`;
  }
  const key = reference.kind === "program" ? "importProgram" : "import";
  return `${origin.replace(/\/$/, "")}/app#${key}=${reference.encoded}`;
}
