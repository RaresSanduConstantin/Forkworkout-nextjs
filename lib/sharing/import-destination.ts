import { buildShortShareUrl, extractShortShare } from "@/lib/sharing/link";
import { decodeProgram } from "@/lib/storage/program-share";
import { decodeWorkout } from "@/lib/storage/share";
import {
  buildSharedImportUrl,
  extractSharedImport,
} from "@/lib/storage/share-link";

/** Validates a pasted/scanned share and returns its canonical local import URL. */
export function getShareImportDestination(
  value: string,
  origin: string
): string | null {
  const shortShare = extractShortShare(value);
  if (shortShare) return buildShortShareUrl(shortShare, origin);

  const reference = extractSharedImport(value);
  if (!reference) return null;
  const valid =
    reference.kind === "program"
      ? decodeProgram(reference.encoded) !== null
      : decodeWorkout(reference.encoded) !== null;
  return valid ? buildSharedImportUrl(reference, origin) : null;
}
