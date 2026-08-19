import { decryptSharedReference, encryptSharedReference } from "@/lib/sharing/crypto";
import { buildShortShareUrl } from "@/lib/sharing/link";
import {
  SHORT_SHARE_ID_PATTERN,
  encryptedShareEnvelopeSchema,
  type SharedReference,
} from "@/lib/sharing/types";

export type CloudShareErrorCode =
  | "unavailable"
  | "expired"
  | "rate_limited"
  | "invalid";

export class CloudShareError extends Error {
  constructor(
    public readonly code: CloudShareErrorCode,
    message: string
  ) {
    super(message);
    this.name = "CloudShareError";
  }
}

async function requestWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    throw new CloudShareError("unavailable", "Cloud sharing is temporarily unavailable.");
  } finally {
    window.clearTimeout(timeout);
  }
}

async function responseError(response: Response): Promise<CloudShareError> {
  let message = "Cloud sharing is temporarily unavailable.";
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === "string" && body.message) message = body.message;
  } catch {
    // Keep the generic message for non-JSON gateway errors.
  }
  if (response.status === 404) return new CloudShareError("expired", message);
  if (response.status === 429) return new CloudShareError("rate_limited", message);
  if (response.status === 400 || response.status === 413) {
    return new CloudShareError("invalid", message);
  }
  return new CloudShareError("unavailable", message);
}

export async function createCloudShare(
  reference: SharedReference,
  origin: string
): Promise<string> {
  const encrypted = await encryptSharedReference(reference);
  const response = await requestWithTimeout("/api/shares", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ envelope: encrypted.envelope }),
  });
  if (!response.ok) throw await responseError(response);
  const body = (await response.json()) as { id?: unknown };
  if (typeof body.id !== "string" || !SHORT_SHARE_ID_PATTERN.test(body.id)) {
    throw new CloudShareError("invalid", "The share service returned an invalid link.");
  }
  return buildShortShareUrl({ id: body.id, key: encrypted.key }, origin);
}

export async function resolveCloudShare(id: string, key: string): Promise<SharedReference> {
  if (!SHORT_SHARE_ID_PATTERN.test(id)) {
    throw new CloudShareError("expired", "This share does not exist or has expired.");
  }
  const response = await requestWithTimeout(`/api/shares/${encodeURIComponent(id)}`);
  if (!response.ok) throw await responseError(response);
  const body = (await response.json()) as { envelope?: unknown };
  const envelope = encryptedShareEnvelopeSchema.safeParse(body.envelope);
  if (!envelope.success) {
    throw new CloudShareError("invalid", "The stored share is invalid.");
  }
  try {
    return await decryptSharedReference(envelope.data, key);
  } catch (error) {
    throw new CloudShareError(
      "invalid",
      error instanceof Error ? error.message : "This share could not be decrypted."
    );
  }
}

