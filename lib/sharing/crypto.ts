import {
  encryptedShareEnvelopeSchema,
  InvalidShareError,
  MAX_SHARE_PAYLOAD_BYTES,
  SHARE_ENVELOPE_VERSION,
  SharePayloadTooLargeError,
  sharedReferenceSchema,
  type EncryptedShareEnvelope,
  type SharedReference,
} from "@/lib/sharing/types";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const ADDITIONAL_DATA = textEncoder.encode("forkworkout-share-v1");

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new InvalidShareError();
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "="
  );
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    throw new InvalidShareError();
  }
}

function webCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Secure sharing is not supported in this browser.");
  }
  return globalThis.crypto;
}

export async function encryptSharedReference(reference: SharedReference): Promise<{
  envelope: EncryptedShareEnvelope;
  key: string;
}> {
  if (
    typeof reference.encoded === "string" &&
    textEncoder.encode(reference.encoded).byteLength > MAX_SHARE_PAYLOAD_BYTES
  ) {
    throw new SharePayloadTooLargeError();
  }
  const normalized = sharedReferenceSchema.parse(reference);
  const plaintext = textEncoder.encode(JSON.stringify(normalized));

  const cryptoApi = webCrypto();
  const key = await cryptoApi.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const rawKey = new Uint8Array(await cryptoApi.subtle.exportKey("raw", key));
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const encrypted = await cryptoApi.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: ADDITIONAL_DATA },
    key,
    plaintext
  );

  return {
    envelope: {
      v: SHARE_ENVELOPE_VERSION,
      alg: "A256GCM",
      iv: bytesToBase64Url(iv),
      ciphertext: bytesToBase64Url(new Uint8Array(encrypted)),
    },
    key: bytesToBase64Url(rawKey),
  };
}

export async function decryptSharedReference(
  envelopeInput: unknown,
  encodedKey: string
): Promise<SharedReference> {
  const envelope = encryptedShareEnvelopeSchema.safeParse(envelopeInput);
  if (!envelope.success || !/^[A-Za-z0-9_-]{43}$/.test(encodedKey)) {
    throw new InvalidShareError();
  }

  try {
    const cryptoApi = webCrypto();
    const key = await cryptoApi.subtle.importKey(
      "raw",
      base64UrlToBytes(encodedKey),
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );
    const decrypted = await cryptoApi.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64UrlToBytes(envelope.data.iv),
        additionalData: ADDITIONAL_DATA,
      },
      key,
      base64UrlToBytes(envelope.data.ciphertext)
    );
    const parsed: unknown = JSON.parse(textDecoder.decode(decrypted));
    const reference = sharedReferenceSchema.safeParse(parsed);
    if (!reference.success) throw new InvalidShareError();
    return reference.data;
  } catch (error) {
    if (error instanceof InvalidShareError) throw error;
    throw new InvalidShareError("This share could not be decrypted. The link may be incomplete.");
  }
}
