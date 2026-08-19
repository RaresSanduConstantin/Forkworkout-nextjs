import { describe, expect, it } from "vitest";

import { MemoryShareStorage, createShareId } from "@/lib/sharing/storage";
import type { StoredShare } from "@/lib/sharing/types";

const record: StoredShare = {
  v: 1,
  envelope: {
    v: 1,
    alg: "A256GCM",
    iv: "A".repeat(16),
    ciphertext: "B".repeat(20),
  },
  createdAt: "2026-08-19T10:00:00.000Z",
  expiresAt: "2026-09-18T10:00:00.000Z",
};

describe("share storage", () => {
  it("creates opaque 96-bit ids", () => {
    expect(createShareId()).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(createShareId()).not.toBe(createShareId());
  });

  it("expires memory records using their storage TTL", async () => {
    let now = 1_000;
    const storage = new MemoryShareStorage(() => now);
    const id = await storage.create(record, 30);

    await expect(storage.get(id)).resolves.toEqual(record);
    now += 30_000;
    await expect(storage.get(id)).resolves.toBeNull();
  });
});

