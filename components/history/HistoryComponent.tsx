"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, CalendarDays, ClipboardPaste, Download, Dumbbell, FileSpreadsheet, History, ShieldCheck, Trophy, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
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
import {
  buildSharedImportUrl,
  extractSharedImport,
} from "@/lib/storage/share-link";
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
  const [editingEntry, setEditingEntry] = React.useState<CompletedWorkout | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [pendingPRDelete, setPendingPRDelete] = React.useState<RecordRow | null>(null);
  const [backup, setBackup] = React.useState<AutoBackup | null>(null);
  const [showRestore, setShowRestore] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [importLinkOpen, setImportLinkOpen] = React.useState(false);
  const [importLinkValue, setImportLinkValue] = React.useState("");
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
      const {
        workoutsAdded,
        historyAdded,
        bodyAdded,
        exercisesAdded,
        profileRestored,
        homeEquipmentRestored,
      } = mergeImport(text);
      refresh();
      const parts = [
        `${workoutsAdded} workout${workoutsAdded === 1 ? "" : "s"}`,
        `${historyAdded} history entr${historyAdded === 1 ? "y" : "ies"}`,
      ];
      if (bodyAdded) parts.push(`${bodyAdded} body ${bodyAdded === 1 ? "entry" : "entries"}`);
      if (exercisesAdded)
        parts.push(`${exercisesAdded} exercise${exercisesAdded === 1 ? "" : "s"}`);
      if (profileRestored) parts.push("profile");
      if (homeEquipmentRestored) parts.push("home equipment");
      toast.success(`Imported ${parts.join(", ")}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    }
  };

  const pasteImportLink = async () => {
    try {
      const value = await navigator.clipboard.readText();
      if (!value.trim()) {
        toast.error("Your clipboard is empty.");
        return;
      }
      setImportLinkValue(value.trim());
    } catch {
      toast.info("Press and hold in the field, then choose Paste.");
    }
  };

  const submitImportLink = () => {
    const reference = extractSharedImport(importLinkValue);
    if (!reference) {
      toast.error("Paste a ForkWorkout workout or program link.");
      return;
    }

    const valid =
      reference.kind === "program"
        ? decodeProgram(reference.encoded) !== null
        : decodeWorkout(reference.encoded) !== null;
    if (!valid) {
      toast.error(`That shared ${reference.kind} link looks invalid.`);
      return;
    }

    window.location.assign(buildSharedImportUrl(reference, window.location.origin));
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
            Restore (JSON)
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
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => {
            setImportLinkValue("");
            setImportLinkOpen(true);
          }}
        >
          <ClipboardPaste className="size-4" />
          Import link
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleImportFile}
        />
        <p className="text-xs text-muted-foreground">
          The JSON backup is what you restore from. Excel is a read-only snapshot to view or
          analyze — it can&apos;t be imported.
        </p>
        <CloudBackupCard onRestored={refresh} />
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

      <Dialog
        open={importLinkOpen}
        onOpenChange={(nextOpen) => {
          setImportLinkOpen(nextOpen);
          if (!nextOpen) setImportLinkValue("");
        }}
      >
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] min-w-0 max-w-sm flex-col overflow-hidden">
          <DialogHeader className="min-w-0 shrink-0 text-left">
            <DialogTitle>Import a shared link</DialogTitle>
            <DialogDescription>
              Paste a ForkWorkout workout or program link. You&apos;ll review it before
              adding it to this app&apos;s local library.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 min-w-0 space-y-2 overflow-x-hidden overflow-y-auto">
            <Textarea
              value={importLinkValue}
              onChange={(event) => setImportLinkValue(event.target.value)}
              placeholder="https://…/app#import=…"
              rows={4}
              wrap="soft"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Shared ForkWorkout link"
              className="h-28 min-h-28 min-w-0 max-w-full resize-none break-all [field-sizing:fixed] [overflow-wrap:anywhere]"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={pasteImportLink}
            >
              <ClipboardPaste className="size-4" />
              Paste from clipboard
            </Button>
          </div>
          <DialogFooter className="shrink-0 gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setImportLinkOpen(false);
                setImportLinkValue("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={submitImportLink} disabled={!importLinkValue.trim()}>
              <Download className="size-4" />
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
