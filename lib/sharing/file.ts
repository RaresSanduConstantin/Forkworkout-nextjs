import { sharedReferenceSchema, type SharedReference } from "@/lib/sharing/types";

type ShareFile = {
  v: 1;
  type: "forkworkout-share";
  createdAt: string;
  reference: SharedReference;
};

export function buildShareFile(reference: SharedReference, now = new Date()): string {
  return JSON.stringify({
    v: 1,
    type: "forkworkout-share",
    createdAt: now.toISOString(),
    reference: sharedReferenceSchema.parse(reference),
  } satisfies ShareFile);
}

export function parseShareFile(value: string): SharedReference | null {
  try {
    const parsed = JSON.parse(value) as Partial<ShareFile>;
    if (parsed.v !== 1 || parsed.type !== "forkworkout-share") return null;
    const reference = sharedReferenceSchema.safeParse(parsed.reference);
    return reference.success ? reference.data : null;
  } catch {
    return null;
  }
}

export function safeShareFilename(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return `${base || "forkworkout-share"}.forkworkout`;
}

