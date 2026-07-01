// SSR-safe, crash-resistant LocalStorage helpers.
//
// Every read tolerates missing/corrupted data by returning a typed fallback,
// so the app never crashes because LocalStorage contains unexpected values.

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
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
