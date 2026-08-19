import { createCloudShare } from "@/lib/sharing/client";
import { buildShareFile, safeShareFilename } from "@/lib/sharing/file";
import type { SharedReference } from "@/lib/sharing/types";

export const SAFE_SELF_CONTAINED_URL_LENGTH = 1_800;

export type ShareDeliveryResult = {
  method: "native-link" | "clipboard" | "native-file" | "download" | "cancelled";
  usedCloud: boolean;
  usedFallback: boolean;
};

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      return copied;
    } catch {
      return false;
    }
  }
}

function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function deliverSharedReference({
  reference,
  legacyUrl,
  title,
  text,
  origin,
}: {
  reference: SharedReference;
  legacyUrl: string | null;
  title: string;
  text: string;
  origin: string;
}): Promise<ShareDeliveryResult> {
  let url: string | null = null;
  let usedCloud = false;
  try {
    url = await createCloudShare(reference, origin);
    usedCloud = true;
  } catch {
    if (legacyUrl && legacyUrl.length <= SAFE_SELF_CONTAINED_URL_LENGTH) {
      url = legacyUrl;
    }
  }

  if (url) {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return { method: "native-link", usedCloud, usedFallback: !usedCloud };
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return { method: "cancelled", usedCloud, usedFallback: !usedCloud };
        }
      }
    }
    if (await copyText(url)) {
      return { method: "clipboard", usedCloud, usedFallback: !usedCloud };
    }
  }

  const file = new File([buildShareFile(reference)], safeShareFilename(title), {
    type: "application/vnd.forkworkout.share+json",
  });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title, text, files: [file] });
      return { method: "native-file", usedCloud: false, usedFallback: true };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return { method: "cancelled", usedCloud: false, usedFallback: true };
      }
    }
  }
  downloadFile(file);
  return { method: "download", usedCloud: false, usedFallback: true };
}

