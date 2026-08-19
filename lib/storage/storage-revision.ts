import { MIRRORED_LOCAL_STORAGE_KEYS, STORAGE_REVISION_KEY } from "./keys";

export type StorageRevisionChange = {
  revision: number;
  deleted: boolean;
};

export type StorageRevisionMarker = {
  revision: number;
  updatedAt: string;
  changes: Record<string, StorageRevisionChange>;
};

type RevisionStorage = Pick<Storage, "getItem" | "setItem">;

function validRevision(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

export function readStorageRevision(
  storage: Pick<Storage, "getItem">
): StorageRevisionMarker | null {
  try {
    const raw = storage.getItem(STORAGE_REVISION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const revision = validRevision(parsed.revision);
    if (revision === null) return null;

    const changes: Record<string, StorageRevisionChange> = {};
    const rawChanges =
      parsed.changes && typeof parsed.changes === "object"
        ? (parsed.changes as Record<string, unknown>)
        : {};
    for (const key of MIRRORED_LOCAL_STORAGE_KEYS) {
      const rawChange = rawChanges[key];
      if (!rawChange || typeof rawChange !== "object") continue;
      const change = rawChange as Record<string, unknown>;
      const changeRevision = validRevision(change.revision);
      if (changeRevision === null) continue;
      changes[key] = {
        revision: changeRevision,
        deleted: change.deleted === true,
      };
    }

    return {
      revision,
      updatedAt:
        typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
      changes,
    };
  } catch {
    return null;
  }
}

export function createStorageRevision(
  current: StorageRevisionMarker | null,
  minimumRevision: number,
  key: string,
  deleted: boolean
): StorageRevisionMarker {
  const revision = Math.max(current?.revision ?? 0, minimumRevision) + 1;
  return {
    revision,
    updatedAt: new Date().toISOString(),
    changes: {
      ...(current?.changes ?? {}),
      [key]: { revision, deleted },
    },
  };
}

export function writeStorageRevision(
  storage: RevisionStorage,
  marker: StorageRevisionMarker
): boolean {
  try {
    storage.setItem(STORAGE_REVISION_KEY, JSON.stringify(marker));
    return true;
  } catch {
    return false;
  }
}
