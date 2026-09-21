import { z } from "zod";

export const SHARE_ENVELOPE_VERSION = 1 as const;
export const SHARE_TTL_SECONDS = 30 * 24 * 60 * 60;
export const MAX_SHARE_PAYLOAD_BYTES = 256 * 1024;
export const MAX_ENVELOPE_BYTES = 384 * 1024;
export const SHORT_SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{16}$/;
export const SHORT_SHARE_KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const base64UrlSchema = z.string().regex(/^[A-Za-z0-9_-]+$/);

export const sharedReferenceSchema = z.object({
  kind: z.enum(["workout", "program", "nutrition-meal"]),
  encoded: z.string().min(1).max(MAX_SHARE_PAYLOAD_BYTES),
});

export const encryptedShareEnvelopeSchema = z.object({
  v: z.literal(SHARE_ENVELOPE_VERSION),
  alg: z.literal("A256GCM"),
  iv: base64UrlSchema.length(16),
  ciphertext: base64UrlSchema.min(20).max(MAX_ENVELOPE_BYTES),
});

export const storedShareSchema = z.object({
  v: z.literal(SHARE_ENVELOPE_VERSION),
  envelope: encryptedShareEnvelopeSchema,
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export type SharedReference = z.infer<typeof sharedReferenceSchema>;
export type EncryptedShareEnvelope = z.infer<typeof encryptedShareEnvelopeSchema>;
export type StoredShare = z.infer<typeof storedShareSchema>;

export class SharePayloadTooLargeError extends Error {
  constructor() {
    super("This shared item is too large for cloud sharing.");
    this.name = "SharePayloadTooLargeError";
  }
}

export class InvalidShareError extends Error {
  constructor(message = "That ForkWorkout share is invalid.") {
    super(message);
    this.name = "InvalidShareError";
  }
}
