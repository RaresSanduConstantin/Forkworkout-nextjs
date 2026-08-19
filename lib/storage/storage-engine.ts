import { MIRRORED_LOCAL_STORAGE_KEYS, STORAGE_KEYS, STORAGE_RESET_KEY } from "./keys";
import {
  browserIndexedDbStorage,
  type IndexedDbLocalStorageMirror,
  type IndexedDbStorageSnapshot,
} from "./indexeddb-mirror";
import { runtimeStorageCache, type RuntimeStorageMode } from "./runtime-cache";

type BrowserStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type StorageInitializationResult = {
  mode: RuntimeStorageMode;
  source: "indexeddb" | "localstorage" | "fresh";
  recoveredFromIndexedDb: boolean;
  recordCount: number;
};

function readLocalRecords(storage: BrowserStorage): {
  available: boolean;
  records: Record<string, string>;
  resetAt?: string;
} {
  try {
    const records: Record<string, string> = {};
    for (const key of MIRRORED_LOCAL_STORAGE_KEYS) {
      const value = storage.getItem(key);
      if (value !== null) records[key] = value;
    }
    return {
      available: true,
      records,
      resetAt: storage.getItem(STORAGE_RESET_KEY) ?? undefined,
    };
  } catch {
    return { available: false, records: {} };
  }
}

function isResetNewerThanSnapshot(
  resetAt: string | undefined,
  snapshot: IndexedDbStorageSnapshot
): boolean {
  if (!resetAt || !snapshot.completedAt) return false;
  const resetTime = Date.parse(resetAt);
  const databaseTime = Date.parse(snapshot.completedAt);
  return Number.isFinite(resetTime) && Number.isFinite(databaseTime) && resetTime >= databaseTime;
}

function addLocalOnlyValues(storage: BrowserStorage, records: Record<string, string>): void {
  try {
    const schemaVersion = storage.getItem(STORAGE_KEYS.schemaVersion);
    if (schemaVersion !== null) records[STORAGE_KEYS.schemaVersion] = schemaVersion;
  } catch {
    // IndexedDB-backed records are still usable without LocalStorage metadata.
  }
}

function shadowToLocalStorage(storage: BrowserStorage, records: Record<string, string>): void {
  for (const key of MIRRORED_LOCAL_STORAGE_KEYS) {
    try {
      const value = records[key];
      if (value === undefined) storage.removeItem(key);
      else storage.setItem(key, value);
    } catch {
      // IndexedDB is primary. A full/disabled LocalStorage fallback is allowed.
    }
  }
}

function managedRecords(records: Record<string, string>): Record<string, string> {
  const managed: Record<string, string> = {};
  for (const key of MIRRORED_LOCAL_STORAGE_KEYS) {
    const value = records[key];
    if (value !== undefined) managed[key] = value;
  }
  return managed;
}

function isValidStoredJson(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

async function repairCorruptedPrimaryRecords(
  database: IndexedDbLocalStorageMirror,
  primaryRecords: Record<string, string>,
  localRecords: Record<string, string>
): Promise<Record<string, string>> {
  const repaired = { ...primaryRecords };
  for (const key of MIRRORED_LOCAL_STORAGE_KEYS) {
    const primaryValue = primaryRecords[key];
    if (primaryValue === undefined || isValidStoredJson(primaryValue)) continue;

    const fallbackValue = localRecords[key];
    if (fallbackValue !== undefined && isValidStoredJson(fallbackValue)) {
      repaired[key] = fallbackValue;
      await database.set(key, fallbackValue);
    } else {
      delete repaired[key];
      await database.delete(key);
    }
  }
  return repaired;
}

/**
 * Chooses the authoritative local source, performs the one-time cutover, and
 * hydrates the synchronous runtime cache used by the existing storage APIs.
 */
export async function initializeStorageEngine({
  storage,
  database,
}: {
  storage: BrowserStorage;
  database: IndexedDbLocalStorageMirror;
}): Promise<StorageInitializationResult> {
  const local = readLocalRecords(storage);
  let snapshot = await database.getSnapshot();
  snapshot = { ...snapshot, records: managedRecords(snapshot.records) };

  // A reset tombstone prevents an old/blocked database from resurrecting data.
  if (isResetNewerThanSnapshot(local.resetAt, snapshot)) {
    await database.deleteDatabase();
    snapshot = { state: "not-started", mode: "mirror", records: {} };
  }

  if (snapshot.state === "unavailable") {
    const records = { ...local.records };
    addLocalOnlyValues(storage, records);
    runtimeStorageCache.hydrate(records, "localstorage");
    return {
      mode: "localstorage",
      source: Object.keys(local.records).length > 0 ? "localstorage" : "fresh",
      recoveredFromIndexedDb: false,
      recordCount: Object.keys(local.records).length,
    };
  }

  if (snapshot.state === "ready" && snapshot.mode === "primary") {
    const primaryRecords = await repairCorruptedPrimaryRecords(
      database,
      snapshot.records,
      local.records
    );
    const records = { ...primaryRecords };
    addLocalOnlyValues(storage, records);
    runtimeStorageCache.hydrate(records, "indexeddb");
    shadowToLocalStorage(storage, primaryRecords);
    return {
      mode: "indexeddb",
      source: "indexeddb",
      recoveredFromIndexedDb:
        Object.keys(local.records).length === 0 && Object.keys(primaryRecords).length > 0,
      recordCount: Object.keys(primaryRecords).length,
    };
  }

  // During the cutover release LocalStorage wins when it still contains data.
  // This captures any last write made before IndexedDB became authoritative.
  if (local.available && Object.keys(local.records).length > 0) {
    const promoted = await database.syncFromStorage(
      storage,
      MIRRORED_LOCAL_STORAGE_KEYS,
      "primary"
    );
    const records = { ...local.records };
    addLocalOnlyValues(storage, records);
    const mode: RuntimeStorageMode = promoted.state === "ready" ? "indexeddb" : "localstorage";
    runtimeStorageCache.hydrate(records, mode);
    return {
      mode,
      source: "localstorage",
      recoveredFromIndexedDb: false,
      recordCount: Object.keys(local.records).length,
    };
  }

  // A valid pre-cutover mirror is recoverable when LocalStorage unexpectedly
  // disappeared. Promote it instead of overwriting it with an empty snapshot.
  if (
    (snapshot.state === "ready" || snapshot.state === "copying") &&
    Object.keys(snapshot.records).length > 0
  ) {
    const promoted = await database.promoteToPrimary();
    const records = { ...snapshot.records };
    addLocalOnlyValues(storage, records);
    const mode: RuntimeStorageMode = promoted ? "indexeddb" : "localstorage";
    runtimeStorageCache.hydrate(records, mode);
    if (promoted) shadowToLocalStorage(storage, snapshot.records);
    return {
      mode,
      source: "indexeddb",
      recoveredFromIndexedDb: promoted,
      recordCount: Object.keys(snapshot.records).length,
    };
  }

  // Do not leave an empty database shell on a fresh/reset installation. The
  // first real write will create the primary database on demand.
  await database.deleteDatabase();
  const records: Record<string, string> = {};
  addLocalOnlyValues(storage, records);
  runtimeStorageCache.hydrate(records, "indexeddb");
  return {
    mode: "indexeddb",
    source: "fresh",
    recoveredFromIndexedDb: false,
    recordCount: 0,
  };
}

let browserInitialization: Promise<StorageInitializationResult> | null = null;

export function initializeBrowserStorage(): Promise<StorageInitializationResult> {
  if (typeof window === "undefined") {
    return Promise.resolve({
      mode: "localstorage",
      source: "fresh",
      recoveredFromIndexedDb: false,
      recordCount: 0,
    });
  }
  if (!browserInitialization) {
    browserInitialization = initializeStorageEngine({
      storage: window.localStorage,
      database: browserIndexedDbStorage,
    });
  }
  return browserInitialization;
}

export function resetBrowserStorageInitializationForTests(): void {
  browserInitialization = null;
  runtimeStorageCache.reset();
}
