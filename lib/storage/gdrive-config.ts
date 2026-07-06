// Device-local configuration for the optional Google Drive backup feature.
//
// This holds the user's own OAuth Client ID (bring-your-own model) plus the id
// of the backup file we created and the last successful sync time. It is kept
// separate from user data and is intentionally NOT included in the export
// bundle — it's per-device config and shouldn't travel between devices.
//
// Every read tolerates missing/corrupt data and falls back to an empty config
// so the app never crashes because LocalStorage contains unexpected values.

import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson } from "./safe-storage";

export type GDriveConfig = {
  /** The user's own Google OAuth *Web* Client ID. */
  clientId?: string;
  /** Id of the backup file we created in the user's Drive (cached for updates). */
  fileId?: string;
  /** ISO timestamp of the last successful backup/restore. */
  lastSyncAt?: string;
};

const EMPTY: GDriveConfig = {};

function normalize(raw: unknown): GDriveConfig {
  if (!raw || typeof raw !== "object") return { ...EMPTY };
  const r = raw as Record<string, unknown>;
  const out: GDriveConfig = {};
  if (typeof r.clientId === "string" && r.clientId.trim()) out.clientId = r.clientId.trim();
  if (typeof r.fileId === "string" && r.fileId) out.fileId = r.fileId;
  if (typeof r.lastSyncAt === "string" && r.lastSyncAt) out.lastSyncAt = r.lastSyncAt;
  return out;
}

/** Current Drive config, merged with defaults (empty). */
export function getGDriveConfig(): GDriveConfig {
  return normalize(readJson<unknown>(STORAGE_KEYS.gdrive, null));
}

/** Merge a partial update into the current config and persist. */
export function updateGDriveConfig(patch: Partial<GDriveConfig>): GDriveConfig {
  const next = normalize({ ...getGDriveConfig(), ...patch });
  writeJson(STORAGE_KEYS.gdrive, next);
  return next;
}

/** Remove all Drive config (disconnect). */
export function clearGDriveConfig(): boolean {
  return writeJson(STORAGE_KEYS.gdrive, EMPTY);
}

/** Whether a Client ID has been configured (the feature is opt-in). */
export function isGDriveConfigured(): boolean {
  return !!getGDriveConfig().clientId;
}
