// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

import {
  pickLatestFileId,
  buildMultipartBody,
  findBackupFileId,
  uploadBackup,
  downloadBackup,
  BACKUP_FILE_NAME,
} from "@/lib/gdrive/client";
import {
  getGDriveConfig,
  updateGDriveConfig,
  clearGDriveConfig,
  isGDriveConfigured,
} from "@/lib/storage/gdrive-config";

describe("gdrive config", () => {
  beforeEach(() => localStorage.clear());

  it("starts empty and reports not configured", () => {
    expect(getGDriveConfig()).toEqual({});
    expect(isGDriveConfigured()).toBe(false);
  });

  it("stores a trimmed client id and reports configured", () => {
    updateGDriveConfig({ clientId: "  abc.apps.googleusercontent.com  " });
    expect(getGDriveConfig().clientId).toBe("abc.apps.googleusercontent.com");
    expect(isGDriveConfigured()).toBe(true);
  });

  it("merges partial updates and clears", () => {
    updateGDriveConfig({ clientId: "id-1" });
    updateGDriveConfig({ fileId: "file-1", lastSyncAt: "2024-01-01T00:00:00.000Z" });
    const cfg = getGDriveConfig();
    expect(cfg.clientId).toBe("id-1");
    expect(cfg.fileId).toBe("file-1");
    clearGDriveConfig();
    expect(getGDriveConfig()).toEqual({});
  });

  it("tolerates corrupt storage", () => {
    localStorage.setItem("forkworkout:gdrive", "{not json");
    expect(getGDriveConfig()).toEqual({});
  });
});

describe("gdrive pure helpers", () => {
  it("picks the most recently modified file id", () => {
    const list = {
      files: [
        { id: "old", modifiedTime: "2024-01-01T00:00:00.000Z" },
        { id: "new", modifiedTime: "2024-06-01T00:00:00.000Z" },
        { id: "mid", modifiedTime: "2024-03-01T00:00:00.000Z" },
      ],
    };
    expect(pickLatestFileId(list)).toBe("new");
  });

  it("returns null for empty or missing lists", () => {
    expect(pickLatestFileId({ files: [] })).toBeNull();
    expect(pickLatestFileId(null)).toBeNull();
    expect(pickLatestFileId(undefined)).toBeNull();
  });

  it("assembles a multipart/related body with metadata and content", () => {
    const body = buildMultipartBody({ name: BACKUP_FILE_NAME }, '{"a":1}', "BOUND");
    expect(body).toContain("--BOUND");
    expect(body).toContain('"name":"forkworkout-backup.json"');
    expect(body).toContain('{"a":1}');
    expect(body.trimEnd().endsWith("--BOUND--")).toBe(true);
  });
});

describe("gdrive REST calls", () => {
  const token = "test-token";
  let fetchMock: ReturnType<typeof vi.fn>;

  const jsonResponse = (data: unknown, ok = true, status = 200): Response =>
    ({
      ok,
      status,
      json: async () => data,
      text: async () => JSON.stringify(data),
    }) as Response;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("findBackupFileId returns the latest file id", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ files: [{ id: "f1", modifiedTime: "2024-01-01T00:00:00Z" }] })
    );
    const id = await findBackupFileId(token);
    expect(id).toBe("f1");
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("drive/v3/files");
    expect((opts as RequestInit).headers).toMatchObject({ Authorization: `Bearer ${token}` });
  });

  it("uploadBackup creates a new file when none exists", async () => {
    // 1) lookup -> none, 2) multipart create -> id
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ files: [] }))
      .mockResolvedValueOnce(jsonResponse({ id: "created-1" }));
    const id = await uploadBackup(token, '{"v":1}');
    expect(id).toBe("created-1");
    const [, createOpts] = fetchMock.mock.calls[1];
    expect((createOpts as RequestInit).method).toBe("POST");
  });

  it("uploadBackup updates the cached file with a PATCH", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "cached-1" }));
    const id = await uploadBackup(token, '{"v":2}', "cached-1");
    expect(id).toBe("cached-1");
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/files/cached-1");
    expect((opts as RequestInit).method).toBe("PATCH");
  });

  it("uploadBackup falls back to create when the cached file is gone (404)", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, false, 404)) // PATCH cached -> 404
      .mockResolvedValueOnce(jsonResponse({ files: [] })) // lookup -> none
      .mockResolvedValueOnce(jsonResponse({ id: "created-2" })); // create
    const id = await uploadBackup(token, "{}", "stale-id");
    expect(id).toBe("created-2");
  });

  it("downloadBackup returns text + id for an existing backup", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ hello: "world" }));
    const res = await downloadBackup(token, "file-9");
    expect(res).not.toBeNull();
    expect(res?.fileId).toBe("file-9");
    expect(res?.text).toContain("world");
  });

  it("downloadBackup returns null when no backup exists", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ files: [] }));
    const res = await downloadBackup(token);
    expect(res).toBeNull();
  });

  it("surfaces a Drive error message", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: { message: "Rate limit exceeded" } }, false, 403)
    );
    await expect(findBackupFileId(token)).rejects.toThrow("Rate limit exceeded");
  });
});
