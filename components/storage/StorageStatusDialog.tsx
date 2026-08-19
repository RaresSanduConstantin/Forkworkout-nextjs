"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArchiveRestore,
  CheckCircle2,
  Database,
  Download,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ROUTES } from "@/lib/routes";
import {
  getStorageDiagnostics,
  type StorageDiagnostics,
} from "@/lib/storage/diagnostics";
import {
  MIGRATION_BACKUP_RETENTION_DAYS,
  restoreMigrationSafetyBackup,
} from "@/lib/storage/migrations";
import { flushStoragePersistence } from "@/lib/storage/safe-storage";
import { downloadExport } from "@/lib/storage/transfer";

function formatTimestamp(value?: string): string {
  if (!value) return "Not recorded yet";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? format(parsed, "MMM d, yyyy · HH:mm")
    : "Unknown";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-2.5 last:border-b-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium">{value}</dd>
    </div>
  );
}

export function StorageStatusDialog({
  open,
  onOpenChange,
  showBackupNavigation = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showBackupNavigation?: boolean;
}) {
  const [diagnostics, setDiagnostics] = React.useState<StorageDiagnostics | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [confirmMigrationRestore, setConfirmMigrationRestore] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      setDiagnostics(await getStorageDiagnostics());
    } catch {
      toast.error("Storage status could not be read.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) void load();
  }, [load, open]);

  const healthy =
    diagnostics?.source === "indexeddb" && diagnostics.databaseState === "ready";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2">
              <Database className="size-5" />
              Storage &amp; recovery
            </DialogTitle>
            <DialogDescription>
              Check where your data is saved and keep a portable backup before changing
              devices or clearing browser data.
            </DialogDescription>
          </DialogHeader>

          {loading && !diagnostics ? (
            <div className="flex min-h-48 items-center justify-center" role="status">
              <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
              <span className="sr-only">Checking storage</span>
            </div>
          ) : diagnostics ? (
            <div className="space-y-3">
              <div
                className={`flex items-start gap-3 rounded-lg border p-3 ${
                  healthy ? "border-primary/30 bg-primary/5" : "bg-muted/40"
                }`}
              >
                {healthy ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
                ) : (
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium">
                    {healthy ? "IndexedDB is active" : "LocalStorage fallback is active"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {healthy
                      ? "LocalStorage keeps a compatibility copy for crash recovery."
                      : "Your data remains usable, but browser storage capacity may be smaller."}
                  </p>
                </div>
              </div>

              <dl className="rounded-lg border px-3">
                <Detail
                  label="Storage source"
                  value={diagnostics.source === "indexeddb" ? "IndexedDB" : "LocalStorage"}
                />
                <Detail
                  label="Last successful save"
                  value={formatTimestamp(diagnostics.lastSavedAt)}
                />
                <Detail
                  label="Last backup"
                  value={
                    diagnostics.lastBackupAt
                      ? `${formatTimestamp(diagnostics.lastBackupAt)} · ${diagnostics.lastBackupSource}`
                      : "No recorded cloud backup"
                  }
                />
                <Detail
                  label="Approximate data size"
                  value={formatBytes(diagnostics.approximateBytes)}
                />
                <Detail label="Stored sections" value={diagnostics.recordCount} />
                <Detail label="Storage revision" value={diagnostics.revision} />
              </dl>

              {diagnostics.migrationSafetySnapshotAt ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <div className="flex items-start gap-3">
                    <ArchiveRestore
                      className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Migration safety snapshot</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Created {formatTimestamp(diagnostics.migrationSafetySnapshotAt)} before a
                        storage upgrade. This is not a recurring backup and it may be older than
                        your current data. It is kept for {MIGRATION_BACKUP_RETENTION_DAYS} days.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3 gap-2"
                        onClick={() => {
                          onOpenChange(false);
                          setConfirmMigrationRestore(true);
                        }}
                      >
                        <ArchiveRestore className="size-4" aria-hidden />
                        Restore snapshot
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Storage status is unavailable.
            </p>
          )}

          <DialogFooter
            className={`grid grid-cols-1 gap-2 ${
              showBackupNavigation ? "sm:grid-cols-3" : "sm:grid-cols-2"
            }`}
          >
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                downloadExport();
                toast.success("JSON backup downloaded");
              }}
            >
              <Download className="size-4" />
              Export JSON
            </Button>
            {showBackupNavigation ? (
              <Button asChild className="gap-2">
                <Link href={ROUTES.history} onClick={() => onOpenChange(false)}>
                  Backup &amp; restore
                </Link>
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmMigrationRestore}
        onOpenChange={setConfirmMigrationRestore}
        title="Restore migration safety snapshot?"
        description={
          <>
            This replaces your current workouts, programs, history, body data, and supported
            settings with the snapshot from {formatTimestamp(diagnostics?.migrationSafetySnapshotAt)}.
            Export a JSON backup first if you may need your current data.
          </>
        }
        confirmLabel="Restore snapshot"
        destructive
        onConfirm={async () => {
          setConfirmMigrationRestore(false);
          if (!restoreMigrationSafetyBackup()) {
            toast.error("The migration safety snapshot is no longer available.");
            return;
          }
          const persisted = await flushStoragePersistence();
          if (!persisted) {
            toast.warning(
              "Snapshot restored in this tab, but durable storage could not be verified. Export a JSON backup now."
            );
            return;
          }
          toast.success("Migration safety snapshot restored");
          window.location.reload();
        }}
      />
    </>
  );
}
