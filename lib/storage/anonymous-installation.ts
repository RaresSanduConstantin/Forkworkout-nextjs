const DATABASE_NAME = "forkworkout-installation";
const DATABASE_VERSION = 1;
const STORE_NAME = "metadata";
const DEVICE_ID_KEY = "anonymous-device-id";
const FALLBACK_KEY = "forkworkout:anonymous-device-id";
const DEVICE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type InstallationRecord = { key: string; value: string };

function validDeviceId(value: unknown): value is string {
  return typeof value === "string" && DEVICE_ID_PATTERN.test(value);
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB is unavailable."));
    request.onblocked = () => reject(new Error("IndexedDB is blocked."));
  });
}

async function readIndexedDb(): Promise<string | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(DEVICE_ID_KEY) as IDBRequest<
        InstallationRecord | undefined
      >;
      request.onsuccess = () => resolve(validDeviceId(request.result?.value) ? request.result.value : null);
      request.onerror = () => reject(request.error ?? new Error("Could not read installation ID."));
    });
  } finally {
    database.close();
  }
}

async function writeIndexedDb(value: string): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({ key: DEVICE_ID_KEY, value } satisfies InstallationRecord);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not save installation ID."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Could not save installation ID."));
    });
  } finally {
    database.close();
  }
}

/**
 * A random abuse-control identifier, isolated from user data and backups.
 * LocalStorage is only a compatibility fallback for browsers without IndexedDB.
 */
export async function getAnonymousInstallationId(): Promise<string> {
  if (typeof window === "undefined") throw new Error("Installation ID requires a browser.");

  try {
    const stored = await readIndexedDb();
    if (stored) return stored;
  } catch {
    try {
      const fallback = window.localStorage.getItem(FALLBACK_KEY);
      if (validDeviceId(fallback)) return fallback;
    } catch {
      // Generate an in-memory usable identifier below.
    }
  }

  const created = crypto.randomUUID();
  try {
    await writeIndexedDb(created);
  } catch {
    try {
      window.localStorage.setItem(FALLBACK_KEY, created);
    } catch {
      // The endpoint still receives a valid identifier for this attempt.
    }
  }
  return created;
}
