import {
  SHORT_SHARE_ID_PATTERN,
  SHORT_SHARE_KEY_PATTERN,
} from "@/lib/sharing/types";

export type ShortShareReference = { id: string; key: string };

export function buildShortShareUrl(
  reference: ShortShareReference,
  origin: string
): string {
  if (
    !SHORT_SHARE_ID_PATTERN.test(reference.id) ||
    !SHORT_SHARE_KEY_PATTERN.test(reference.key)
  ) {
    throw new Error("Invalid short-share reference.");
  }
  return `${origin.replace(/\/$/, "")}/s/${reference.id}#key=${reference.key}`;
}

/** Extracts a ForkWorkout short link from a URL or surrounding message text. */
export function extractShortShare(value: string | null | undefined): ShortShareReference | null {
  const input = value?.trim();
  if (!input) return null;
  const match = input.match(
    /(?:https?:\/\/[^\s/]+)?\/s\/([A-Za-z0-9_-]{16})#key=([A-Za-z0-9_-]{43})/
  );
  if (!match) return null;
  return { id: match[1], key: match[2] };
}

