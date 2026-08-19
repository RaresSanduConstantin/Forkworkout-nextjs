import { sharedReferenceSchema, type SharedReference } from "@/lib/sharing/types";

const KEY_PREFIX = "forkworkout:share-handoff:";

type ShareHandoff = {
  reference: SharedReference;
  sourceUrl?: string;
};

export function storeShareHandoff(handoff: ShareHandoff): string | null {
  if (typeof window === "undefined") return null;
  const reference = sharedReferenceSchema.safeParse(handoff.reference);
  if (!reference.success) return null;
  try {
    const id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");
    sessionStorage.setItem(
      `${KEY_PREFIX}${id}`,
      JSON.stringify({
        reference: reference.data,
        sourceUrl: handoff.sourceUrl,
      })
    );
    return id;
  } catch {
    return null;
  }
}

export function consumeShareHandoff(id: string | null): ShareHandoff | null {
  if (typeof window === "undefined" || !id || !/^[a-f0-9]{24}$/.test(id)) return null;
  const key = `${KEY_PREFIX}${id}`;
  try {
    const raw = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { reference?: unknown; sourceUrl?: unknown };
    const reference = sharedReferenceSchema.safeParse(parsed.reference);
    if (!reference.success) return null;
    return {
      reference: reference.data,
      sourceUrl: typeof parsed.sourceUrl === "string" ? parsed.sourceUrl : undefined,
    };
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

