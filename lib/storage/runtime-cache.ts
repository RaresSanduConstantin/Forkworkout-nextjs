export type RuntimeStorageMode = "indexeddb" | "localstorage";

class RuntimeStorageCache {
  private values = new Map<string, string>();
  private ready = false;
  private mode: RuntimeStorageMode = "localstorage";

  hydrate(records: Record<string, string>, mode: RuntimeStorageMode): void {
    this.values = new Map(Object.entries(records));
    this.mode = mode;
    this.ready = true;
  }

  isReady(): boolean {
    return this.ready;
  }

  getMode(): RuntimeStorageMode {
    return this.mode;
  }

  get(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.values.set(key, value);
  }

  delete(key: string): void {
    this.values.delete(key);
  }

  /** Used by tests and a complete same-session user-data reset. */
  reset(mode: RuntimeStorageMode = "localstorage"): void {
    this.values.clear();
    this.mode = mode;
    this.ready = false;
  }
}

export const runtimeStorageCache = new RuntimeStorageCache();
