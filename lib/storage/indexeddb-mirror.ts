import { MIRRORED_LOCAL_STORAGE_KEYS } from "./keys";

const DEFAULT_DATABASE_NAME = "forkworkout";
const DATABASE_VERSION = 1;
const RECORD_STORE = "local-storage-mirror";
const META_STORE = "meta";
const MIRROR_META_KEY = "local-storage-mirror";
const MIRROR_FORMAT_VERSION = 1;

type MirrorRecord = {
  key: string;
  value: string;
  updatedAt: string;
};

type MirrorMeta = {
  key: typeof MIRROR_META_KEY;
  state: "copying" | "ready";
  formatVersion: number;
  mode?: IndexedDbStorageMode;
  completedAt?: string;
  revision?: number;
  keyRevisions?: Record<string, number>;
};

export type IndexedDbStorageMode = "mirror" | "primary";

export type IndexedDbStorageSnapshot = {
  state: "ready" | "copying" | "not-started" | "unavailable";
  mode: IndexedDbStorageMode;
  records: Record<string, string>;
  completedAt?: string;
  revision: number;
  keyRevisions: Record<string, number>;
};

export type IndexedDbMirrorStatus =
  | { state: "ready"; mode: IndexedDbStorageMode; recordCount: number; completedAt?: string }
  | { state: "copying"; mode: IndexedDbStorageMode; recordCount: number }
  | { state: "not-started"; recordCount: 0 }
  | { state: "unavailable"; recordCount: 0 };

type StorageReader = Pick<Storage, "getItem">;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
  });
}

/**
 * Versioned IndexedDB storage used first as a LocalStorage mirror and then as
 * the primary persistence layer.
 *
 * Operations are serialized so migration, writes, and explicit deletion cannot
 * race each other.
 */
export class IndexedDbLocalStorageMirror {
  private databasePromise: Promise<IDBDatabase> | null = null;
  private operationQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly getFactory: () => IDBFactory | undefined,
    private readonly databaseName = DEFAULT_DATABASE_NAME
  ) {}

  private openDatabase(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;

    const factory = this.getFactory();
    if (!factory) return Promise.reject(new Error("IndexedDB is unavailable."));

    this.databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(this.databaseName, DATABASE_VERSION);
      let settled = false;

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(RECORD_STORE)) {
          database.createObjectStore(RECORD_STORE, { keyPath: "key" });
        }
        if (!database.objectStoreNames.contains(META_STORE)) {
          database.createObjectStore(META_STORE, { keyPath: "key" });
        }
      };
      request.onerror = () => {
        settled = true;
        reject(request.error ?? new Error("Could not open IndexedDB."));
      };
      request.onblocked = () => {
        settled = true;
        reject(new Error("IndexedDB upgrade is blocked by another tab."));
      };
      request.onsuccess = () => {
        const database = request.result;
        if (settled) {
          database.close();
          return;
        }
        database.onversionchange = () => {
          database.close();
          this.databasePromise = null;
        };
        database.onclose = () => {
          this.databasePromise = null;
        };
        resolve(database);
      };
    }).catch((error) => {
      this.databasePromise = null;
      throw error;
    });

    return this.databasePromise;
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationQueue.then(operation, operation);
    this.operationQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  private async deleteDatabaseNow(): Promise<boolean> {
    const factory = this.getFactory();
    if (!factory) return false;

    const databasePromise = this.databasePromise;
    this.databasePromise = null;
    if (databasePromise) {
      try {
        (await databasePromise).close();
      } catch {
        // Continue with deletion when opening/closing the database failed.
      }
    }

    return new Promise<boolean>((resolve) => {
      const request = factory.deleteDatabase(this.databaseName);
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
      // Other ForkWorkout tabs close their connection through
      // `onversionchange`; keep waiting for the deletion to finish.
    });
  }

  private async syncNow(
    storage: StorageReader,
    keys: readonly string[],
    mode: IndexedDbStorageMode,
    revision: number
  ): Promise<IndexedDbMirrorStatus> {
    // Capture one coherent LocalStorage snapshot before opening a transaction.
    // If storage access itself throws, leave any previous mirror untouched.
    const snapshot: MirrorRecord[] = [];
    const updatedAt = new Date().toISOString();
    for (const key of keys) {
      const value = storage.getItem(key);
      if (value !== null) snapshot.push({ key, value, updatedAt });
    }

    // A fresh or fully reset installation should not retain even an empty
    // database shell or migration metadata.
    if (snapshot.length === 0) {
      const deleted = await this.deleteDatabaseNow();
      return deleted
        ? { state: "not-started", recordCount: 0 }
        : { state: "unavailable", recordCount: 0 };
    }

    const database = await this.openDatabase();
    const transaction = database.transaction([RECORD_STORE, META_STORE], "readwrite");
    const done = transactionComplete(transaction);
    const records = transaction.objectStore(RECORD_STORE);
    const meta = transaction.objectStore(META_STORE);

    records.clear();
    meta.put({
      key: MIRROR_META_KEY,
      state: "copying",
      formatVersion: MIRROR_FORMAT_VERSION,
      mode,
      revision,
      keyRevisions: Object.fromEntries(keys.map((key) => [key, revision])),
    } satisfies MirrorMeta);
    for (const record of snapshot) records.put(record);
    await done;

    // Verify the committed copy before marking it ready for a future rollout.
    const verifyTransaction = database.transaction(RECORD_STORE, "readonly");
    const verifyDone = transactionComplete(verifyTransaction);
    const recordCount = await requestResult(verifyTransaction.objectStore(RECORD_STORE).count());
    await verifyDone;
    if (recordCount !== snapshot.length) {
      throw new Error("IndexedDB mirror verification failed.");
    }

    const completedAt = new Date().toISOString();
    const readyTransaction = database.transaction(META_STORE, "readwrite");
    const readyDone = transactionComplete(readyTransaction);
    readyTransaction.objectStore(META_STORE).put({
      key: MIRROR_META_KEY,
      state: "ready",
      formatVersion: MIRROR_FORMAT_VERSION,
      mode,
      completedAt,
      revision,
      keyRevisions: Object.fromEntries(keys.map((key) => [key, revision])),
    } satisfies MirrorMeta);
    await readyDone;

    return { state: "ready", mode, recordCount, completedAt };
  }

  async syncFromStorage(
    storage: StorageReader,
    keys: readonly string[] = MIRRORED_LOCAL_STORAGE_KEYS,
    mode: IndexedDbStorageMode = "mirror",
    revision = 0
  ): Promise<IndexedDbMirrorStatus> {
    try {
      return await this.enqueue(() => this.syncNow(storage, keys, mode, revision));
    } catch {
      return { state: "unavailable", recordCount: 0 };
    }
  }

  private async mutateRecordNow(
    key: string,
    revision: number | undefined,
    mutate: (records: IDBObjectStore) => void
  ): Promise<void> {
    const database = await this.openDatabase();
    const transaction = database.transaction([RECORD_STORE, META_STORE], "readwrite");
    const done = transactionComplete(transaction);
    const records = transaction.objectStore(RECORD_STORE);
    const meta = transaction.objectStore(META_STORE);
    const metaRequest = meta.get(MIRROR_META_KEY) as IDBRequest<MirrorMeta | undefined>;

    metaRequest.onsuccess = () => {
      const current = metaRequest.result;
      const currentRevision = current?.revision ?? 0;
      const currentKeyRevision = current?.keyRevisions?.[key] ?? 0;
      const nextRevision = revision ?? Math.max(currentRevision, currentKeyRevision) + 1;

      // Another tab may commit a newer mutation first. Do not let a delayed
      // transaction overwrite it or move the revision clock backwards.
      if (nextRevision < currentKeyRevision) return;

      mutate(records);
      meta.put({
        key: MIRROR_META_KEY,
        state: "ready",
        formatVersion: MIRROR_FORMAT_VERSION,
        mode: "primary",
        completedAt: new Date().toISOString(),
        revision: Math.max(currentRevision, nextRevision),
        keyRevisions: {
          ...(current?.keyRevisions ?? {}),
          [key]: nextRevision,
        },
      } satisfies MirrorMeta);
    };
    await done;
  }

  async set(key: string, value: string, revision?: number): Promise<void> {
    return this.enqueue(async () => {
      await this.mutateRecordNow(key, revision, (records) => {
        records.put({
          key,
          value,
          updatedAt: new Date().toISOString(),
        } satisfies MirrorRecord);
      });
    });
  }

  async delete(key: string, revision?: number): Promise<void> {
    return this.enqueue(async () => {
      await this.mutateRecordNow(key, revision, (records) => records.delete(key));
    });
  }

  async get(key: string): Promise<string | null> {
    await this.operationQueue;
    try {
      const database = await this.openDatabase();
      const transaction = database.transaction(RECORD_STORE, "readonly");
      const done = transactionComplete(transaction);
      const record = await requestResult(
        transaction.objectStore(RECORD_STORE).get(key) as IDBRequest<MirrorRecord | undefined>
      );
      await done;
      return record?.value ?? null;
    } catch {
      return null;
    }
  }

  async getStatus(): Promise<IndexedDbMirrorStatus> {
    await this.operationQueue;
    try {
      const database = await this.openDatabase();
      const transaction = database.transaction([RECORD_STORE, META_STORE], "readonly");
      const done = transactionComplete(transaction);
      const recordCountRequest = transaction.objectStore(RECORD_STORE).count();
      const metaRequest = transaction.objectStore(META_STORE).get(MIRROR_META_KEY) as IDBRequest<
        MirrorMeta | undefined
      >;
      const [recordCount, meta] = await Promise.all([
        requestResult(recordCountRequest),
        requestResult(metaRequest),
      ]);
      await done;

      if (!meta) return { state: "not-started", recordCount: 0 };
      const mode = meta.mode ?? "mirror";
      if (meta.state === "copying") return { state: "copying", mode, recordCount };
      return { state: "ready", mode, recordCount, completedAt: meta.completedAt };
    } catch {
      return { state: "unavailable", recordCount: 0 };
    }
  }

  async getSnapshot(): Promise<IndexedDbStorageSnapshot> {
    await this.operationQueue;
    try {
      const database = await this.openDatabase();
      const transaction = database.transaction([RECORD_STORE, META_STORE], "readonly");
      const done = transactionComplete(transaction);
      const recordsRequest = transaction.objectStore(RECORD_STORE).getAll() as IDBRequest<
        MirrorRecord[]
      >;
      const metaRequest = transaction.objectStore(META_STORE).get(MIRROR_META_KEY) as IDBRequest<
        MirrorMeta | undefined
      >;
      const [storedRecords, meta] = await Promise.all([
        requestResult(recordsRequest),
        requestResult(metaRequest),
      ]);
      await done;

      const records: Record<string, string> = {};
      for (const record of storedRecords) {
        if (typeof record.key === "string" && typeof record.value === "string") {
          records[record.key] = record.value;
        }
      }
      if (!meta) {
        return {
          state: "not-started",
          mode: "mirror",
          records: {},
          revision: 0,
          keyRevisions: {},
        };
      }
      return {
        state: meta.state,
        mode: meta.mode ?? "mirror",
        records,
        completedAt: meta.completedAt,
        revision: meta.revision ?? 0,
        keyRevisions: meta.keyRevisions ?? {},
      };
    } catch {
      return {
        state: "unavailable",
        mode: "mirror",
        records: {},
        revision: 0,
        keyRevisions: {},
      };
    }
  }

  async promoteToPrimary(): Promise<boolean> {
    try {
      return await this.enqueue(async () => {
        const database = await this.openDatabase();
        const transaction = database.transaction(META_STORE, "readwrite");
        const done = transactionComplete(transaction);
        const meta = transaction.objectStore(META_STORE);
        const request = meta.get(MIRROR_META_KEY) as IDBRequest<MirrorMeta | undefined>;
        request.onsuccess = () => {
          meta.put({
            ...request.result,
            key: MIRROR_META_KEY,
            state: "ready",
            formatVersion: MIRROR_FORMAT_VERSION,
            mode: "primary",
            completedAt: new Date().toISOString(),
            revision: request.result?.revision ?? 0,
            keyRevisions: request.result?.keyRevisions ?? {},
          } satisfies MirrorMeta);
        };
        await done;
        return true;
      });
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.operationQueue;
    const databasePromise = this.databasePromise;
    this.databasePromise = null;
    if (!databasePromise) return;
    try {
      (await databasePromise).close();
    } catch {
      // The database was unavailable or already closed.
    }
  }

  /** Deletes the complete mirror database, including its migration metadata. */
  async deleteDatabase(): Promise<boolean> {
    try {
      return await this.enqueue(() => this.deleteDatabaseNow());
    } catch {
      return false;
    }
  }
}

export const browserIndexedDbStorage = new IndexedDbLocalStorageMirror(() =>
  typeof window === "undefined" ? undefined : window.indexedDB
);

/** Queues an authoritative IndexedDB write without blocking synchronous UI APIs. */
export function scheduleIndexedDbMirrorWrite(
  key: string,
  value: string,
  revision?: number
): void {
  if (!MIRRORED_LOCAL_STORAGE_KEYS.includes(key)) return;
  void browserIndexedDbStorage.set(key, value, revision).catch(() => undefined);
}

/** Queues an authoritative IndexedDB deletion. */
export function scheduleIndexedDbMirrorDelete(key: string, revision?: number): void {
  if (!MIRRORED_LOCAL_STORAGE_KEYS.includes(key)) return;
  void browserIndexedDbStorage.delete(key, revision).catch(() => undefined);
}

/** Completely removes the IndexedDB database after a user data reset. */
export function deleteIndexedDbMirror(): Promise<boolean> {
  return browserIndexedDbStorage.deleteDatabase();
}
