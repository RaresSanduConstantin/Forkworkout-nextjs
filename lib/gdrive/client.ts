// Client-side Google Drive backup — bring-your-own OAuth Client ID.
//
// The whole flow runs in the browser: Google Identity Services (GIS) issues a
// short-lived access token (no client secret, no backend), and the Drive REST
// API stores a single visible `forkworkout-backup.json` in the user's My Drive.
// Scope is limited to `drive.file`, so the app can only ever see files it
// created — i.e. exactly this backup file.

export const BACKUP_FILE_NAME = "forkworkout-backup.json";
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const GIS_SRC = "https://accounts.google.com/gsi/client";

// --- Pure helpers (unit-tested; no browser APIs) -------------------------

type DriveFile = { id: string; modifiedTime?: string };
type DriveFileList = { files?: DriveFile[] };

/**
 * Given a Drive `files.list` response, return the id of the most recently
 * modified file (our backup), or null if there are none.
 */
export function pickLatestFileId(list: DriveFileList | null | undefined): string | null {
  const files = list?.files;
  if (!Array.isArray(files) || files.length === 0) return null;
  const sorted = [...files]
    .filter((f) => f && typeof f.id === "string")
    .sort((a, b) => (b.modifiedTime ?? "").localeCompare(a.modifiedTime ?? ""));
  return sorted[0]?.id ?? null;
}

/**
 * Assemble a `multipart/related` body for creating a Drive file with both
 * metadata and JSON content in a single request.
 */
export function buildMultipartBody(
  metadata: Record<string, unknown>,
  json: string,
  boundary: string
): string {
  return (
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    "Content-Type: application/json\r\n\r\n" +
    `${json}\r\n` +
    `--${boundary}--`
  );
}

/**
 * A user-facing Drive URL for a file id (opens the file in the Drive web UI).
 */
export function driveFileUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

// --- Browser-only: GIS token flow ---------------------------------------

type TokenResponse = { access_token?: string; error?: string };
type TokenClient = { requestAccessToken: (opts?: { prompt?: string }) => void };

interface GoogleOAuth2 {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (resp: TokenResponse) => void;
    error_callback?: (err: { type?: string }) => void;
  }) => TokenClient;
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } };
  }
}

let gisPromise: Promise<void> | null = null;

/** Inject and await the Google Identity Services script (once). */
export function loadGis(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Not in a browser"));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google sign-in")));
      if (window.google?.accounts?.oauth2) resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisPromise = null;
      reject(new Error("Failed to load Google sign-in"));
    };
    document.head.appendChild(script);
  });
  return gisPromise;
}

/**
 * Request a Drive access token via GIS. Resolves with the token, or rejects if
 * the user cancels/denies or the popup can't open.
 */
export async function requestAccessToken(clientId: string): Promise<string> {
  await loadGis();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error("Google sign-in unavailable");
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (resp) => {
        if (settled) return;
        settled = true;
        if (resp.access_token) resolve(resp.access_token);
        else if (resp.error === "access_denied")
          reject(
            new Error(
              "Google blocked access (403). Add your account under Test users in the Google Auth Platform → Audience screen, then try again."
            )
          );
        else reject(new Error(resp.error || "Google sign-in was cancelled"));
      },
      error_callback: (err) => {
        if (settled) return;
        settled = true;
        reject(
          new Error(err?.type === "popup_closed" ? "Sign-in window was closed" : "Google sign-in failed")
        );
      },
    });
    client.requestAccessToken({ prompt: "" });
  });
}

// --- Browser-only: Drive REST calls -------------------------------------

async function driveError(res: Response, fallback: string): Promise<never> {
  let detail = "";
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    detail = body?.error?.message ?? "";
  } catch {
    /* ignore */
  }
  throw new Error(detail || `${fallback} (HTTP ${res.status})`);
}

/** Find the id of our existing backup file, or null if there isn't one yet. */
export async function findBackupFileId(token: string): Promise<string | null> {
  const params = new URLSearchParams({
    q: `name='${BACKUP_FILE_NAME}' and trashed=false`,
    spaces: "drive",
    fields: "files(id,modifiedTime)",
    orderBy: "modifiedTime desc",
    pageSize: "10",
  });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) await driveError(res, "Couldn't reach Google Drive");
  const list = (await res.json()) as DriveFileList;
  return pickLatestFileId(list);
}

/**
 * Upload the backup JSON to Drive. Updates the existing file when one is known
 * (cached id or a lookup), otherwise creates a new visible file. Returns the id.
 */
export async function uploadBackup(
  token: string,
  json: string,
  cachedFileId?: string
): Promise<string> {
  const fileId = cachedFileId || (await findBackupFileId(token));

  if (fileId) {
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: json,
      }
    );
    if (res.status === 404 && cachedFileId) {
      // The cached file was deleted — create a fresh one.
      return uploadBackup(token, json);
    }
    if (!res.ok) await driveError(res, "Backup upload failed");
    const body = (await res.json()) as DriveFile;
    return body.id ?? fileId;
  }

  const boundary = `forkworkout-${Date.now()}`;
  const metadata = { name: BACKUP_FILE_NAME, mimeType: "application/json" };
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: buildMultipartBody(metadata, json, boundary),
    }
  );
  if (!res.ok) await driveError(res, "Backup upload failed");
  const body = (await res.json()) as DriveFile;
  if (!body.id) throw new Error("Drive didn't return a file id");
  return body.id;
}

/**
 * Download the backup JSON text from Drive, or null if no backup exists yet.
 */
export async function downloadBackup(
  token: string,
  cachedFileId?: string
): Promise<{ fileId: string; text: string } | null> {
  const fileId = cachedFileId || (await findBackupFileId(token));
  if (!fileId) return null;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) {
    // Stale cached id — retry via lookup once.
    if (cachedFileId) return downloadBackup(token);
    return null;
  }
  if (!res.ok) await driveError(res, "Couldn't download the backup");
  const text = await res.text();
  return { fileId, text };
}
