import { browserIndexedDbStorage } from "./indexeddb-mirror";
import { MIRRORED_LOCAL_STORAGE_KEYS } from "./keys";
import {
  getMigrationSafetyBackup,
  migrationSafetyBackupHasData,
} from "./migrations";
import { getGDriveConfig } from "./gdrive-config";
import { runtimeStorageCache } from "./runtime-cache";
import { readStorageRevision } from "./storage-revision";

export type StorageDiagnostics = {
  source: "indexeddb" | "localstorage";
  databaseState: "ready" | "copying" | "not-started" | "unavailable";
  lastSavedAt?: string;
  lastBackupAt?: string;
  lastBackupSource?: "Google Drive";
  migrationSafetySnapshotAt?: string;
  approximateBytes: number;
  recordCount: number;
  revision: number;
};

function latestBackup(): Pick<
  StorageDiagnostics,
  "lastBackupAt" | "lastBackupSource"
> {
  const drive = getGDriveConfig();
  return drive.lastSyncAt
    ? {
        lastBackupAt: drive.lastSyncAt,
        lastBackupSource: "Google Drive",
      }
    : {};
}

/** Reads storage health only when the user opens the diagnostics dialog. */
export async function getStorageDiagnostics(): Promise<StorageDiagnostics> {
  const migrationSafetySnapshot = getMigrationSafetyBackup();
  const snapshot = await browserIndexedDbStorage.getSnapshot();
  if (snapshot.state === "not-started") {
    // `getSnapshot` must open IndexedDB to inspect it. Do not leave an empty
    // shell behind on a fresh or deliberately reset installation.
    await browserIndexedDbStorage.deleteDatabase();
  }

  const records: Record<string, string> = {};
  for (const key of MIRRORED_LOCAL_STORAGE_KEYS) {
    const value = runtimeStorageCache.isReady()
      ? runtimeStorageCache.get(key)
      : window.localStorage.getItem(key);
    if (value !== null) records[key] = value;
  }
  const approximateBytes = Object.entries(records).reduce(
    (total, [key, value]) => total + new TextEncoder().encode(key + value).byteLength,
    0
  );
  const localRevision = readStorageRevision(window.localStorage);
  const source = runtimeStorageCache.isReady()
    ? runtimeStorageCache.getMode()
    : snapshot.state === "ready"
      ? "indexeddb"
      : "localstorage";

  return {
    source,
    databaseState: snapshot.state,
    lastSavedAt:
      source === "indexeddb" ? snapshot.completedAt : localRevision?.updatedAt,
    approximateBytes,
    recordCount: Object.keys(records).length,
    revision: Math.max(snapshot.revision, localRevision?.revision ?? 0),
    migrationSafetySnapshotAt: migrationSafetyBackupHasData(migrationSafetySnapshot)
      ? migrationSafetySnapshot?.savedAt
      : undefined,
    ...latestBackup(),
  };
}
