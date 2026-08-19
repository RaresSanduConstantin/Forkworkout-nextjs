import { describe, expect, it } from "vitest";

import {
  decryptSharedReference,
  encryptSharedReference,
} from "@/lib/sharing/crypto";
import { buildShortShareUrl, extractShortShare } from "@/lib/sharing/link";
import {
  InvalidShareError,
  MAX_SHARE_PAYLOAD_BYTES,
  SharePayloadTooLargeError,
} from "@/lib/sharing/types";

describe("encrypted short shares", () => {
  it("round-trips a program reference without exposing it in the envelope", async () => {
    const reference = { kind: "program" as const, encoded: "secret-program-payload" };
    const encrypted = await encryptSharedReference(reference);

    expect(JSON.stringify(encrypted.envelope)).not.toContain(reference.encoded);
    expect(encrypted.key).toHaveLength(43);
    await expect(decryptSharedReference(encrypted.envelope, encrypted.key)).resolves.toEqual(
      reference
    );
  });

  it("rejects a modified encrypted payload", async () => {
    const encrypted = await encryptSharedReference({
      kind: "workout",
      encoded: "workout-payload",
    });
    const replacement = encrypted.envelope.ciphertext[8] === "A" ? "B" : "A";
    const tampered = {
      ...encrypted.envelope,
      ciphertext: `${encrypted.envelope.ciphertext.slice(0, 8)}${replacement}${encrypted.envelope.ciphertext.slice(9)}`,
    };

    await expect(decryptSharedReference(tampered, encrypted.key)).rejects.toBeInstanceOf(
      InvalidShareError
    );
  });

  it("rejects compressed content larger than 256 KiB", async () => {
    await expect(
      encryptSharedReference({
        kind: "workout",
        encoded: "A".repeat(MAX_SHARE_PAYLOAD_BYTES + 1),
      })
    ).rejects.toBeInstanceOf(SharePayloadTooLargeError);
  });

  it("builds and extracts a short link from message text", () => {
    const reference = {
      id: "Ab3xK91pQr5sT7uV",
      key: "A".repeat(43),
    };
    const url = buildShortShareUrl(reference, "https://forkworkout.test/");

    expect(url).toBe(
      `https://forkworkout.test/s/${reference.id}#key=${reference.key}`
    );
    expect(extractShortShare(`Try this: ${url}`)).toEqual(reference);
  });
});
