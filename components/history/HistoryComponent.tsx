"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, CalendarDays, Download, Dumbbell, History, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import CalendarComponent from "@/components/Calendar";
import { StreakSummary } from "@/components/history/StreakSummary";
import { VolumeChart } from "@/components/history/VolumeChart";
import { HistoryList } from "@/components/history/HistoryList";
import {
  getCompletedWorkouts,
  deleteCompletedWorkout,
} from "@/lib/storage/history-storage";
import { downloadExport, mergeImport } from "@/lib/storage/transfer";
import {
  getAutoBackup,
  autoBackupHasData,
  restoreAutoBackup,
  type AutoBackup,
} from "@/lib/storage/migrations";
import { ROUTES } from "@/lib/routes";
import type { CompletedWorkout } from "@/lib/types";

const HistoryComponent = () => {
  const [entries, setEntries] = React.useState<CompletedWorkout[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<CompletedWorkout | null>(null);
  const [backup, setBackup] = React.useState<AutoBackup | null>(null);
  const [showRestore, setShowRestore] = React.useState(false);
  // Bumped on mutations to force storage-reading children (calendar, streak) to refresh.
  const [version, setVersion] = React.useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setEntries(getCompletedWorkouts());
    setBackup(getAutoBackup());
    setLoaded(true);
  }, []);

  const refresh = () => {
    setEntries(getCompletedWorkouts());
    setBackup(getAutoBackup());
    setVersion((v) => v + 1);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteCompletedWorkout(pendingDelete.date);
    refresh();
    toast.success("Removed from history");
    setPendingDelete(null);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file
    if (!file) return;
    try {
      const text = await file.text();
      const { workoutsAdded, historyAdded, bodyAdded } = mergeImport(text);
      refresh();
      toast.success(
        `Imported ${workoutsAdded} workout${workoutsAdded === 1 ? "" : "s"}, ${historyAdded} history entr${
          historyAdded === 1 ? "y" : "ies"
        }${bodyAdded ? ` and ${bodyAdded} body ${bodyAdded === 1 ? "entry" : "entries"}` : ""}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    }
  };

  return (
    <PageContainer>
      <Button asChild variant="ghost" size="sm" className="mb-2 gap-1 px-2">
        <Link href={ROUTES.dashboard}>
          <ArrowLeft className="size-4" />
          Go Back
        </Link>
      </Button>

      <PageHeader
        title="History"
        description="Your completed workouts and streak, saved on this device."
      />

      <div className="mb-6 flex gap-2">
        <Button variant="outline" className="flex-1 gap-2" onClick={downloadExport}>
          <Download className="size-4" />
          Export data
        </Button>
        <Button
          variant="outline"
          className="flex-1 gap-2"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="size-4" />
          Import data
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleImportFile}
        />
      </div>

      {backup && autoBackupHasData(backup) && (
        <div className="mb-6 flex flex-col gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            <ShieldCheck className="mr-1 inline size-4 text-primary" />
            Auto-backup saved {format(new Date(backup.savedAt), "MMM d, HH:mm")}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowRestore(true)}
          >
            <History className="size-4" />
            Restore backup
          </Button>
        </div>
      )}

      <div className="space-y-8">
        <StreakSummary key={`streak-${version}`} />

        <VolumeChart entries={entries} />

        <CalendarComponent key={`cal-${version}`} />

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Recent activity</h2>
          </div>

          {loaded && entries.length === 0 ? (
            <EmptyState
              icon={<Dumbbell className="size-8" />}
              title="No completed workouts yet"
              description="Finish a workout and it will show up here, and your streak will start to grow."
              action={
                <Button asChild>
                  <Link href={ROUTES.dashboard}>Go to your workouts</Link>
                </Button>
              }
            />
          ) : (
            <HistoryList entries={entries} onDelete={setPendingDelete} />
          )}
        </section>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Remove this workout from history?"
        description="This deletes the completed-workout record and updates your streak. It cannot be undone."
        confirmLabel="Remove"
        destructive
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={showRestore}
        onOpenChange={setShowRestore}
        title="Restore the last backup?"
        description="This replaces your current workouts, history and body metrics with the auto-backup snapshot. Consider exporting your current data first — this can't be undone."
        confirmLabel="Restore"
        destructive
        onConfirm={() => {
          setShowRestore(false);
          if (restoreAutoBackup()) {
            refresh();
            toast.success("Backup restored");
          } else {
            toast.error("No backup available");
          }
        }}
      />
    </PageContainer>
  );
};

export default HistoryComponent;
