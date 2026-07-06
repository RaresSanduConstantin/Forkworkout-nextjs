"use client";

import * as React from "react";
import { format } from "date-fns";
import { Cloud, CloudUpload, CloudDownload, Copy, ExternalLink, Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { buildExport, mergeImport } from "@/lib/storage/transfer";
import {
  getGDriveConfig,
  updateGDriveConfig,
  clearGDriveConfig,
  type GDriveConfig,
} from "@/lib/storage/gdrive-config";
import { requestAccessToken, uploadBackup, downloadBackup, driveFileUrl } from "@/lib/gdrive/client";

// App-wide Google OAuth Client ID (public — safe to embed). When set, users get
// one-tap "Back up / Restore" with no setup. When unset, the card falls back to
// the bring-your-own-Client-ID flow for power users.
const APP_CLIENT_ID = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "").trim();

/**
 * Opt-in Google Drive backup for power users. Bring-your-own OAuth Client ID:
 * the user pastes their own Web Client ID, then can back up / restore a single
 * visible `forkworkout-backup.json` in their Drive. Everything runs
 * client-side; nothing is sent to any ForkWorkout server.
 */
export function CloudBackupCard({ onRestored }: { onRestored?: () => void }) {
  const [config, setConfig] = React.useState<GDriveConfig | null>(null);
  const [origin, setOrigin] = React.useState("");
  const [setupOpen, setSetupOpen] = React.useState(false);
  const [clientIdInput, setClientIdInput] = React.useState("");
  const [busy, setBusy] = React.useState<"backup" | "restore" | null>(null);

  React.useEffect(() => {
    const cfg = getGDriveConfig();
    setConfig(cfg);
    setClientIdInput(cfg.clientId ?? "");
    setOrigin(window.location.origin);
  }, []);

  // Don't render config-dependent UI until we've read LocalStorage on the client
  // (avoids a hydration mismatch).
  if (config === null) return null;

  // Prefer the app-wide Client ID (one-tap for everyone); otherwise use the
  // user's own (bring-your-own power-user flow).
  const clientId = APP_CLIENT_ID || config.clientId;
  const canManage = !APP_CLIENT_ID; // nothing to manage when the app provides the ID

  const saveClientId = () => {
    const id = clientIdInput.trim();
    if (!id) {
      toast.error("Paste your Google OAuth Client ID first.");
      return;
    }
    const next = updateGDriveConfig({ clientId: id });
    setConfig(next);
    setSetupOpen(false);
    toast.success("Google Drive connected. You can now back up.");
  };

  const disconnect = () => {
    clearGDriveConfig();
    setConfig({});
    setClientIdInput("");
    toast.success("Disconnected from Google Drive.");
  };

  const handleBackup = async () => {
    if (!clientId || busy) return;
    setBusy("backup");
    try {
      const token = await requestAccessToken(clientId);
      const json = JSON.stringify(buildExport(), null, 2);
      const fileId = await uploadBackup(token, json, config.fileId);
      const next = updateGDriveConfig({ fileId, lastSyncAt: new Date().toISOString() });
      setConfig(next);
      toast.success("Backed up to Google Drive.", {
        action: {
          label: "Open in Drive",
          onClick: () => window.open(driveFileUrl(fileId), "_blank", "noopener,noreferrer"),
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Backup failed.");
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async () => {
    if (!clientId || busy) return;
    setBusy("restore");
    try {
      const token = await requestAccessToken(clientId);
      const result = await downloadBackup(token, config.fileId);
      if (!result) {
        toast.error("No backup found in this Google account yet.");
        return;
      }
      const r = mergeImport(result.text);
      const parts: string[] = [];
      if (r.workoutsAdded) parts.push(`${r.workoutsAdded} workouts`);
      if (r.historyAdded) parts.push(`${r.historyAdded} sessions`);
      if (r.bodyAdded) parts.push(`${r.bodyAdded} body entries`);
      if (r.exercisesAdded) parts.push(`${r.exercisesAdded} exercises`);
      updateGDriveConfig({ fileId: result.fileId, lastSyncAt: new Date().toISOString() });
      setConfig(getGDriveConfig());
      toast.success(parts.length ? `Restored ${parts.join(", ")}.` : "Already up to date — nothing new to restore.");
      onRestored?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Restore failed.");
    } finally {
      setBusy(null);
    }
  };

  const copyOrigin = async () => {
    try {
      await navigator.clipboard.writeText(origin);
      toast.success("Copied this app's URL.");
    } catch {
      toast.error("Couldn't copy — copy it manually.");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Cloud className="size-4 text-primary" />
          <p className="text-sm font-semibold">Cloud backup (Google Drive)</p>
        </div>
        {clientId ? (
          <Badge variant="secondary" className="shrink-0">Connected</Badge>
        ) : (
          <Badge variant="outline" className="shrink-0">Optional · advanced</Badge>
        )}
      </div>

      {clientId ? (
        <>
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              disabled={busy !== null}
              onClick={handleBackup}
            >
              {busy === "backup" ? <Loader2 className="size-4 animate-spin" /> : <CloudUpload className="size-4" />}
              Back up
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2"
              disabled={busy !== null}
              onClick={handleRestore}
            >
              {busy === "restore" ? <Loader2 className="size-4 animate-spin" /> : <CloudDownload className="size-4" />}
              Restore
            </Button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">
                {config.lastSyncAt
                  ? `Last synced ${format(new Date(config.lastSyncAt), "MMM d, HH:mm")}`
                  : "Sign in with Google to save a forkworkout-backup.json in your Drive."}
              </p>
              {config.fileId && (
                <a
                  href={driveFileUrl(config.fileId)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary underline"
                >
                  <ExternalLink className="size-3" />
                  Open in Drive
                </a>
              )}
            </div>
            {canManage && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto shrink-0 gap-1 px-1 text-xs text-muted-foreground"
                onClick={() => {
                  setClientIdInput(clientId);
                  setSetupOpen(true);
                }}
              >
                <Settings2 className="size-3.5" />
                Manage
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-xs text-muted-foreground">
            For power users: back up to your own Google Drive with your own OAuth
            Client ID. Your data goes only to your Drive — never to us.
          </p>
          <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={() => setSetupOpen(true)}>
            <Settings2 className="size-4" />
            Set up
          </Button>
        </>
      )}

      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader className="text-left">
            <DialogTitle>Connect Google Drive</DialogTitle>
            <DialogDescription>
              Bring your own Google OAuth Client ID. This keeps ForkWorkout
              account-free — your backup lives in your Drive, under your control.
            </DialogDescription>
          </DialogHeader>

          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              In{" "}
              <a
                href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 font-medium text-primary underline"
              >
                Google Cloud <ExternalLink className="size-3" />
              </a>
              , create a project and enable the <strong>Google Drive API</strong>.
            </li>
            <li>
              Configure the OAuth consent screen (External), scope{" "}
              <code>drive.file</code>. Then — this is the step most people miss —
              open{" "}
              <a
                href="https://console.cloud.google.com/auth/audience"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 font-medium text-primary underline"
              >
                Audience <ExternalLink className="size-3" />
              </a>{" "}
              and add your Google account under <strong>Test users</strong>
              {" "}(otherwise Google returns <code>Error 403: access_denied</code>).
            </li>
            <li>
              Create an OAuth <strong>Client ID → Web application</strong>. Under
              <strong> Authorized JavaScript origins</strong>, add this app&apos;s URL:
              <span className="mt-1 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1 text-xs">
                  {origin || "(this site's URL)"}
                </code>
                <Button variant="outline" size="sm" className="h-7 gap-1 px-2" onClick={copyOrigin}>
                  <Copy className="size-3.5" />
                  Copy
                </Button>
              </span>
            </li>
            <li>Paste the Client ID below.</li>
          </ol>

          <div className="space-y-1.5">
            <Label htmlFor="gdrive-client-id">Google OAuth Client ID</Label>
            <Input
              id="gdrive-client-id"
              value={clientIdInput}
              onChange={(e) => setClientIdInput(e.target.value)}
              placeholder="1234567890-abc.apps.googleusercontent.com"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {clientId ? (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={disconnect}
              >
                Disconnect
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={saveClientId}>Save Client ID</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
