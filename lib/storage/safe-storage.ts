// SSR-safe, crash-resistant LocalStorage helpers.
//
// Every read tolerates missing/corrupted data by returning a typed fallback,
// so the app never crashes because LocalStorage contains unexpected values.

import {
  browserIndexedDbStorage,
  deleteIndexedDbMirror,
  scheduleIndexedDbMirrorDelete,
  scheduleIndexedDbMirrorWrite,
} from "./indexeddb-mirror";
import { MIRRORED_LOCAL_STORAGE_KEYS, STORAGE_RESET_KEY } from "./keys";
import { runtimeStorageCache } from "./runtime-cache";

const isBrowser = () => typeof window !== "undefined";

export function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/** Read and parse a JSON value from LocalStorage, falling back on any failure. */
export function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  if (runtimeStorageCache.isReady()) {
    return safeJsonParse<T>(runtimeStorageCache.get(key), fallback);
  }
  try {
    return safeJsonParse<T>(window.localStorage.getItem(key), fallback);
  } catch {
    // Access to localStorage can throw (private mode, quota, disabled).
    return fallback;
  }
}

/** Serialize and write a JSON value. Returns false if persistence failed. */
export function writeJson<T>(key: string, value: T): boolean {
  if (!isBrowser()) return false;
  const serialized = JSON.stringify(value);
  if (typeof serialized !== "string") return false;

  if (runtimeStorageCache.isReady()) {
    runtimeStorageCache.set(key, serialized);
    const indexedDbPrimary =
      runtimeStorageCache.getMode() === "indexeddb" &&
      MIRRORED_LOCAL_STORAGE_KEYS.includes(key);
    if (indexedDbPrimary) scheduleIndexedDbMirrorWrite(key, serialized);

    let localStorageSaved = false;
    try {
      window.localStorage.setItem(key, serialized);
      localStorageSaved = true;
    } catch {
      // IndexedDB remains authoritative when the compatibility fallback is full.
    }
    return indexedDbPrimary || localStorageSaved;
  }

  try {
    window.localStorage.setItem(key, serialized);
    return true;
  } catch {
    return false;
  }
}

/** Remove a value from LocalStorage and its best-effort IndexedDB mirror. */
export function removeJson(key: string): boolean {
  if (!isBrowser()) return false;
  if (runtimeStorageCache.isReady()) {
    runtimeStorageCache.delete(key);
    const indexedDbPrimary =
      runtimeStorageCache.getMode() === "indexeddb" &&
      MIRRORED_LOCAL_STORAGE_KEYS.includes(key);
    if (indexedDbPrimary) scheduleIndexedDbMirrorDelete(key);

    let localStorageRemoved = false;
    try {
      window.localStorage.removeItem(key);
      localStorageRemoved = true;
    } catch {
      // The authoritative IndexedDB delete has already been queued.
    }
    return indexedDbPrimary || localStorageRemoved;
  }

  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Makes the current synchronous runtime snapshot durable in IndexedDB.
 *
 * Normal writes stay non-blocking for responsive UI. Bulk restore flows call
 * this before reporting success so a preceding reset and queued writes cannot
 * race, and so the restored snapshot is verified before the user leaves the
 * page.
 */
export async function flushStoragePersistence(): Promise<boolean> {
  if (!isBrowser() || !runtimeStorageCache.isReady()) return false;
  if (runtimeStorageCache.getMode() !== "indexeddb") return true;

  try {
    // These operations are serialized behind any reset or writes already in
    // progress. Re-applying the complete snapshot also repairs a failed queued
    // write instead of merely waiting for it.
    for (const key of MIRRORED_LOCAL_STORAGE_KEYS) {
      const value = runtimeStorageCache.get(key);
      if (value === null) await browserIndexedDbStorage.delete(key);
      else await browserIndexedDbStorage.set(key, value);
    }

    const snapshot = await browserIndexedDbStorage.getSnapshot();
    if (snapshot.state !== "ready" || snapshot.mode !== "primary") return false;

    const verified = MIRRORED_LOCAL_STORAGE_KEYS.every(
      (key) => (snapshot.records[key] ?? null) === runtimeStorageCache.get(key)
    );
    if (verified) {
      // A verified new snapshot supersedes the deletion tombstone. Keeping the
      // tombstone could reject a legitimate restore if both timestamps landed
      // in the same millisecond.
      try {
        window.localStorage.removeItem(STORAGE_RESET_KEY);
      } catch {
        // The verified IndexedDB snapshot remains authoritative.
      }
    }
    return verified;
  } catch {
    return false;
  }
}

/** Applies a compatibility-fallback update made in another same-origin tab. */
export function applyExternalStorageChange(event: StorageEvent): void {
  if (!runtimeStorageCache.isReady() || !event.key) return;
  try {
    if (event.storageArea !== window.localStorage) return;
  } catch {
    return;
  }

  if (event.key === STORAGE_RESET_KEY && event.newValue !== null) {
    runtimeStorageCache.hydrate({}, "indexeddb");
    void deleteIndexedDbMirror().finally(() => window.location.reload());
    return;
  }
  if (!MIRRORED_LOCAL_STORAGE_KEYS.includes(event.key)) return;

  if (event.newValue === null) {
    runtimeStorageCache.delete(event.key);
    if (runtimeStorageCache.getMode() === "indexeddb") {
      scheduleIndexedDbMirrorDelete(event.key);
    }
  } else {
    runtimeStorageCache.set(event.key, event.newValue);
    if (runtimeStorageCache.getMode() === "indexeddb") {
      scheduleIndexedDbMirrorWrite(event.key, event.newValue);
    }
  }
}
