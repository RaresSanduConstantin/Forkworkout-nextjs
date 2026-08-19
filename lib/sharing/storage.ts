import { randomBytes } from "node:crypto";

import type { Redis } from "@upstash/redis";

import { storedShareSchema, type StoredShare } from "@/lib/sharing/types";

const KEY_PREFIX = "forkworkout:share:";
const MAX_ID_ATTEMPTS = 4;

export class ShareStorageUnavailableError extends Error {
  constructor(message = "Cloud sharing is temporarily unavailable.") {
    super(message);
    this.name = "ShareStorageUnavailableError";
  }
}

export interface ShareStorage {
  create(record: StoredShare, ttlSeconds: number): Promise<string>;
  get(id: string): Promise<StoredShare | null>;
}

export function createShareId(): string {
  return randomBytes(12).toString("base64url");
}

export class UpstashShareStorage implements ShareStorage {
  constructor(private readonly redis: Redis) {}

  async create(record: StoredShare, ttlSeconds: number): Promise<string> {
    const normalized = storedShareSchema.parse(record);
    try {
      for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
        const id = createShareId();
        const result = await this.redis.set(`${KEY_PREFIX}${id}`, normalized, {
          ex: ttlSeconds,
          nx: true,
        });
        if (result === "OK") return id;
      }
    } catch {
      throw new ShareStorageUnavailableError();
    }
    throw new ShareStorageUnavailableError("Couldn't allocate a short share link.");
  }

  async get(id: string): Promise<StoredShare | null> {
    try {
      const value = await this.redis.get<unknown>(`${KEY_PREFIX}${id}`);
      if (value === null) return null;
      const parsed = storedShareSchema.safeParse(value);
      return parsed.success ? parsed.data : null;
    } catch {
      throw new ShareStorageUnavailableError();
    }
  }
}

export class DisabledShareStorage implements ShareStorage {
  async create(): Promise<string> {
    throw new ShareStorageUnavailableError();
  }

  async get(): Promise<StoredShare | null> {
    throw new ShareStorageUnavailableError();
  }
}

export class MemoryShareStorage implements ShareStorage {
  private readonly records = new Map<string, { record: StoredShare; expiresAt: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  async create(record: StoredShare, ttlSeconds: number): Promise<string> {
    const id = createShareId();
    this.records.set(id, {
      record: storedShareSchema.parse(record),
      expiresAt: this.now() + ttlSeconds * 1000,
    });
    return id;
  }

  async get(id: string): Promise<StoredShare | null> {
    const stored = this.records.get(id);
    if (!stored) return null;
    if (stored.expiresAt <= this.now()) {
      this.records.delete(id);
      return null;
    }
    return stored.record;
  }
}

