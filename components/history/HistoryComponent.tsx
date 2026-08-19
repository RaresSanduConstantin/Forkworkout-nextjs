"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Download, Dumbbell, FileSpreadsheet, HardDrive, Trophy, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import CalendarComponent from "@/components/Calendar";
import { StreakSummary } from "@/components/history/StreakSummary";
import { VolumeChart } from "@/components/history/VolumeChart";
import { MuscleInsights } from "@/components/history/MuscleInsights";
import {
  RecordsList,
  buildExerciseRecords,
  type RecordRow,
} from "@/components/history/RecordsList";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HistoryList } from "@/components/history/HistoryList";
import { EditHistoryEntryDialog } from "@/components/history/EditHistoryEntryDialog";
import { CloudBackupCard } from "@/components/history/CloudBackupCard";
import { StorageStatusDialog } from "@/components/storage/StorageStatusDialog";
import {
  getCompletedWorkouts,
  deleteCompletedWorkout,
  saveCompletedWorkouts,
} from "@/lib/storage/history-storage";
import { excludeCurrentExercisePR } from "@/lib/history-stats";
import { downloadExport, mergeImport } from "@/lib/storage/transfer";
import { downloadExcel } from "@/lib/storage/excel-export";
import { decodeWorkout } from "@/lib/storage/share";
import { decodeProgram } from "@/lib/storage/program-share";
import { buildSharedImportUrl } from "@/lib/storage/share-link";
import { parseShareFile } from "@/lib/sharing/file";
import { storeShareHandoff } from "@/lib/sharing/handoff";
import { ROUTES } from "@/lib/routes";
import { flushStoragePersistence } from "@/lib/storage/safe-storage";
import type { CompletedWorkout } from "@/lib/types";

const HistoryComponent = () => {
  const [entries, setEntries] = React.useState<CompletedWorkout[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<CompletedWorkout | null>(null);
  const [editingEntry, setEditingEntry] = React.useState<CompletedWorkout | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [pendingPRDelete, setPendingPRDelete] = React.useState<RecordRow | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const [storageStatusOpen, setStorageStatusOpen] = React.useState(false);
  // Bumped on mutations to force storage-reading children (calendar, streak) to refresh.
  const [version, setVersion] = React.useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setEntries(getCompletedWorkouts());
    setLoaded(true);
  }, []);

  const refresh = () => {
    setEntries(getCompletedWorkouts());
    setVersion((v) => v + 1);
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      await downloadExcel();
    } catch (err) {
      console.error("Excel export failed:", err);
      toast.error("Couldn't build the Excel file.");
    } finally {
      setExporting(false);
    }
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteCompletedWorkout(pendingDelete.date);
    refresh();
    toast.success("Removed from history");
    setPendingDelete(null);
  };

  const confirmPRDelete = () => {
    if (!pendingPRDelete) return;
    const next = excludeCurrentExercisePR(pendingPRDelete.name, entries);
    if (!next || !saveCompletedWorkouts(next)) {
      toast.error("Couldn't delete that personal record.");
      return;
    }
    refresh();
    toast.success(`Deleted ${pendingPRDelete.name} PR`);
    setPendingPRDelete(null);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file
    if (!file) return;
    try {
      const text = await file.text();
      const sharedReference = parseShareFile(text);
      if (sharedReference) {
        const valid =
          sharedReference.kind === "program"
            ? decodeProgram(sharedReference.encoded) !== null
            : decodeWorkout(sharedReference.encoded) !== null;
        if (!valid) throw new Error("That ForkWorkout share file is invalid.");

        const handoffId = storeShareHandoff({ reference: sharedReference });
        window.location.assign(
          handoffId
            ? `${ROUTES.dashboard}?shareHandoff=${handoffId}`
            : buildSharedImportUrl(sharedReference, window.location.origin)
        );
        return;
      }
      const {
        workoutsAdded,
        historyAdded,
        bodyAdded,
        exercisesAdded,
        profileRestored,
        settingsRestored,
        homeEquipmentRestored,
      } = mergeImport(text, { restoreSettings: true });
      const persisted = await flushStoragePersistence();
      refresh();
      const parts = [
        `${workoutsAdded} workout${workoutsAdded === 1 ? "" : "s"}`,
        `${historyAdded} history entr${historyAdded === 1 ? "y" : "ies"}`,
      ];
      if (bodyAdded) parts.push(`${bodyAdded} body ${bodyAdded === 1 ? "entry" : "entries"}`);
      if (exercisesAdded)
        parts.push(`${exercisesAdded} exercise${exercisesAdded === 1 ? "" : "s"}`);
      if (profileRestored) parts.push("profile");
      if (settingsRestored) parts.push("settings");
      if (homeEquipmentRestored) parts.push("home equipment");
      if (!persisted) {
        toast.warning(
          `Imported ${parts.join(", ")}, but the device database could not be verified. Export a backup before closing the app.`
        );
      } else {
        toast.success(`Imported ${parts.join(", ")}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    }
  };

  return (
    <PageContainer className="pb-24">
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

      <div className="mb-2 space-y-2">
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 gap-2" onClick={downloadExport}>
            <Download className="size-4" />
            Backup (JSON)
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-4" />
            Restore / import file
          </Button>
        </div>
        <Button
          variant="outline"
          className="w-full gap-2"
          disabled={exporting}
          onClick={handleExportExcel}
        >
          <FileSpreadsheet className="size-4" />
          {exporting ? "Preparing…" : "Export to Excel (for viewing)"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json,.forkworkout,application/vnd.forkworkout.share+json"
          className="hidden"
          onChange={handleImportFile}
        />
        <p className="text-xs text-muted-foreground">
          Restore a JSON backup or import a portable .forkworkout share file. Excel is a
          read-only snapshot — it can&apos;t be imported.
        </p>
        <CloudBackupCard onRestored={refresh} />
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={() => setStorageStatusOpen(true)}
        >
          <HardDrive className="size-4" />
          Storage &amp; recovery
        </Button>
      </div>

      <div className="space-y-8">
        <StreakSummary key={`streak-${version}`} />

        <CalendarComponent key={`cal-${version}`} />

        <VolumeChart entries={entries} />

        {entries.length > 0 && <MuscleInsights history={entries} />}

        {(() => {
          const recordCount = buildExerciseRecords(entries).length;
          if (entries.length === 0 || recordCount === 0) return null;
          return (
            <Accordion type="single" collapsible className="rounded-lg border px-4">
              <AccordionItem value="records">
                <AccordionTrigger className="hover:no-underline">
                  <span className="flex items-center gap-2 text-xl font-semibold">
                    <Trophy className="size-5 text-muted-foreground" />
                    Personal records
                    <span className="text-sm font-normal text-muted-foreground">
                      ({recordCount})
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <RecordsList history={entries} onDelete={setPendingPRDelete} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          );
        })()}

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
            <HistoryList
              entries={entries}
              onEdit={(entry) => {
                setEditingEntry(entry);
                setEditOpen(true);
              }}
              onDelete={setPendingDelete}
            />
          )}
        </section>
      </div>

      <EditHistoryEntryDialog
        open={editOpen}
        entry={editingEntry}
        onOpenChange={setEditOpen}
        onSaved={refresh}
      />

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
        open={pendingPRDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingPRDelete(null);
        }}
        title={`Delete ${pendingPRDelete?.name ?? "this"} personal record?`}
        description="The workout and completed set will stay in your history, but this result will no longer count toward PRs. Your next-best result may take its place."
        confirmLabel="Delete PR"
        destructive
        onConfirm={confirmPRDelete}
      />

      <StorageStatusDialog
        open={storageStatusOpen}
        onOpenChange={setStorageStatusOpen}
        showBackupNavigation={false}
      />

    </PageContainer>
  );
};

export default HistoryComponent;
