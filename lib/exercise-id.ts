/** Normalize an exercise display name for deterministic compatibility IDs. */
export function normalizeExerciseIdentityName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

/** Small deterministic hash; avoids collisions between similarly slugged names. */
function hashName(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Stable local ID for libraries that historically only stored exercise names.
 * Bundled exercise names are fixed; custom exercises persist this ID on rename.
 */
export function exerciseIdFromName(
  name: string,
  source: "builtin" | "custom" = "builtin"
): string {
  const normalized = normalizeExerciseIdentityName(name) || "exercise";
  const slug = normalized.replace(/\s+/g, "-").slice(0, 48);
  return `${source}:${slug}:${hashName(normalized)}`;
}

