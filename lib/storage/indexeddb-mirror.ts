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
};

export type IndexedDbStorageMode = "mirror" | "primary";

export type IndexedDbStorageSnapshot = {
  state: "ready" | "copying" | "not-started" | "unavailable";
  mode: IndexedDbStorageMode;
  records: Record<string, string>;
  completedAt?: string;
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
    mode: IndexedDbStorageMode
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
    } satisfies MirrorMeta);
    await readyDone;

    return { state: "ready", mode, recordCount, completedAt };
  }

  async syncFromStorage(
    storage: StorageReader,
    keys: readonly string[] = MIRRORED_LOCAL_STORAGE_KEYS,
    mode: IndexedDbStorageMode = "mirror"
  ): Promise<IndexedDbMirrorStatus> {
    try {
      return await this.enqueue(() => this.syncNow(storage, keys, mode));
    } catch {
      return { state: "unavailable", recordCount: 0 };
    }
  }

  async set(key: string, value: string): Promise<void> {
    return this.enqueue(async () => {
      const database = await this.openDatabase();
      const transaction = database.transaction([RECORD_STORE, META_STORE], "readwrite");
      const done = transactionComplete(transaction);
      transaction.objectStore(RECORD_STORE).put({
        key,
        value,
        updatedAt: new Date().toISOString(),
      } satisfies MirrorRecord);
      transaction.objectStore(META_STORE).put({
        key: MIRROR_META_KEY,
        state: "ready",
        formatVersion: MIRROR_FORMAT_VERSION,
        mode: "primary",
        completedAt: new Date().toISOString(),
      } satisfies MirrorMeta);
      await done;
    });
  }

  async delete(key: string): Promise<void> {
    return this.enqueue(async () => {
      const database = await this.openDatabase();
      const transaction = database.transaction(RECORD_STORE, "readwrite");
      const done = transactionComplete(transaction);
      transaction.objectStore(RECORD_STORE).delete(key);
      await done;
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
      if (!meta) return { state: "not-started", mode: "mirror", records: {} };
      return {
        state: meta.state,
        mode: meta.mode ?? "mirror",
        records,
        completedAt: meta.completedAt,
      };
    } catch {
      return { state: "unavailable", mode: "mirror", records: {} };
    }
  }

  async promoteToPrimary(): Promise<boolean> {
    try {
      return await this.enqueue(async () => {
        const database = await this.openDatabase();
        const transaction = database.transaction(META_STORE, "readwrite");
        const done = transactionComplete(transaction);
        transaction.objectStore(META_STORE).put({
          key: MIRROR_META_KEY,
          state: "ready",
          formatVersion: MIRROR_FORMAT_VERSION,
          mode: "primary",
          completedAt: new Date().toISOString(),
        } satisfies MirrorMeta);
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
export function scheduleIndexedDbMirrorWrite(key: string, value: string): void {
  if (!MIRRORED_LOCAL_STORAGE_KEYS.includes(key)) return;
  void browserIndexedDbStorage.set(key, value).catch(() => undefined);
}

/** Queues an authoritative IndexedDB deletion. */
export function scheduleIndexedDbMirrorDelete(key: string): void {
  if (!MIRRORED_LOCAL_STORAGE_KEYS.includes(key)) return;
  void browserIndexedDbStorage.delete(key).catch(() => undefined);
}

/** Completely removes the IndexedDB database after a user data reset. */
export function deleteIndexedDbMirror(): Promise<boolean> {
  return browserIndexedDbStorage.deleteDatabase();
}
