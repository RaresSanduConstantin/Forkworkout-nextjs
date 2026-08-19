"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpDown, CalendarDays, Copy, Download, Dumbbell, Flame, Layers3, Play, Plus, Scale, ScanLine, SkipForward, Sparkles, Trash2, Trophy } from "lucide-react";

import { honkFont } from "@/lib/honkFont";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatCard } from "@/components/shared/StatCard";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { WorkoutCard } from "@/components/workouts/WorkoutCard";
import { WorkoutPreviewDialog } from "@/components/workouts/WorkoutPreviewDialog";
import { StarterWorkouts } from "@/components/workouts/StarterWorkouts";
import { WeeklyGoalCard } from "@/components/dashboard/WeeklyGoalCard";
import { OnboardingDialog } from "@/components/onboarding/OnboardingDialog";
import { ReorderExercisesDialog } from "@/components/exercises/ReorderExercisesDialog";
import { WorkoutWizard } from "@/components/workouts/WorkoutWizard";
import { ProgramDialog } from "@/components/programs/ProgramDialog";
import { ProgramCard } from "@/components/programs/ProgramCard";
import { ImportShareDialog } from "@/components/sharing/ImportShareDialog";
import {
  ShareMethodTabs,
  type ShareMethod,
} from "@/components/sharing/ShareMethodTabs";
import { getWorkouts, deleteWorkout, upsertWorkout, duplicateWorkout, uniqueWorkoutTitle, saveWorkouts } from "@/lib/storage/workout-storage";
import { getCompletedDayKeys, getCompletedWorkouts } from "@/lib/storage/history-storage";
import { buildShareUrl, decodeWorkout, encodeWorkout, type DecodedShare } from "@/lib/storage/share";
import { buildProgramShareUrl, decodeProgram, encodeProgram, type DecodedProgramShare } from "@/lib/storage/program-share";
import {
  buildSharedImportUrl,
  extractSharedImport,
  type SharedImportReference,
} from "@/lib/storage/share-link";
import { consumeShareHandoff } from "@/lib/sharing/handoff";
import { buildShortShareUrl, extractShortShare } from "@/lib/sharing/link";
import { deliverSharedReference } from "@/lib/sharing/delivery";
import { createCloudShare } from "@/lib/sharing/client";
import { MAX_SHARE_PAYLOAD_BYTES } from "@/lib/sharing/types";
import {
  createProgram,
  deleteProgram,
  getNextProgramWorkout,
  getProgramState,
  removeWorkoutFromPrograms,
  saveProgramState,
  setActiveProgram,
  skipNextProgramWorkout,
  upsertProgram,
  type ProgramProgress,
} from "@/lib/storage/program-storage";
import { clearAllData } from "@/lib/storage/reset";
import { hasCustomExercises, getCustomExercises, addCustomExercise } from "@/lib/storage/custom-exercises";
import { computeStreak } from "@/lib/date/streak";
import { getSettings } from "@/lib/storage/settings";
import { instantiateTemplate, type WorkoutTemplate } from "@/lib/templates";
import { ROUTES, FEEDBACK_MAILTO } from "@/lib/routes";
import type { CompletedWorkout, Workout, WorkoutProgram } from "@/lib/types";
import { toast } from "sonner";

type AddCustomInput = Parameters<typeof addCustomExercise>[0];

type IncomingShare =
  | { kind: "workout"; decoded: DecodedShare }
  | { kind: "program"; decoded: DecodedProgramShare };

function decodeIncomingShare(reference: SharedImportReference): IncomingShare | null {
  if (reference.kind === "program") {
    const decoded = decodeProgram(reference.encoded);
    return decoded ? { kind: "program", decoded } : null;
  }
  const decoded = decodeWorkout(reference.encoded);
  return decoded ? { kind: "workout", decoded } : null;
}

function isStandaloneApp(): boolean {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    // Older/iOS embedded browsers may not expose the async Clipboard API.
    try {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      return copied;
    } catch {
      return false;
    }
  }
}

const WorkoutList = () => {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [streak, setStreak] = useState(0);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [completedWorkouts, setCompletedWorkouts] = useState<CompletedWorkout[]>([]);
  const [programs, setPrograms] = useState<WorkoutProgram[]>([]);
  const [activeProgramId, setActiveProgramId] = useState<string | undefined>();
  const [programProgress, setProgramProgress] = useState<Record<string, ProgramProgress>>({});
  const [programDialogOpen, setProgramDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<WorkoutProgram | null>(null);
  const [pendingProgramDelete, setPendingProgramDelete] = useState<WorkoutProgram | null>(null);
  const [programShareTarget, setProgramShareTarget] = useState<WorkoutProgram | null>(null);
  const [pendingProgramImport, setPendingProgramImport] = useState<DecodedProgramShare | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Workout | null>(null);
  const [previewWorkout, setPreviewWorkout] = useState<Workout | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showClearAll, setShowClearAll] = useState(false);
  const [keepCustomExercises, setKeepCustomExercises] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [pendingImport, setPendingImport] = useState<Workout | null>(null);
  const [pendingCustom, setPendingCustom] = useState<AddCustomInput[]>([]);
  const [pendingShareLink, setPendingShareLink] = useState<string | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [shareTarget, setShareTarget] = useState<Workout | null>(null);
  const [shareMessage, setShareMessage] = useState("");
  const [shareMethod, setShareMethod] = useState<ShareMethod>("link");
  const [shareQrUrl, setShareQrUrl] = useState<string | null>(null);
  const [shareQrLoading, setShareQrLoading] = useState(false);
  const [shareQrError, setShareQrError] = useState<string | null>(null);
  const [importShareOpen, setImportShareOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [lastWorkoutId, setLastWorkoutId] = useState<string | null>(null);
  const qrRequestRef = useRef(0);

  // Derive from current workouts so the card hides if that workout is deleted.
  const lastWorkout = lastWorkoutId
    ? workouts.find((w) => w.id === lastWorkoutId) ?? null
    : null;
  const activeProgram = programs.find((program) => program.id === activeProgramId) ?? null;
  const nextProgramWorkout = activeProgram
    ? getNextProgramWorkout(
        activeProgram,
        workouts,
        completedWorkouts,
        programProgress[activeProgram.id]
      )
    : null;
  const jumpWorkout = nextProgramWorkout?.workout ?? lastWorkout;

  const moveWorkout = (from: number, to: number) => {
    setWorkouts((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      saveWorkouts(next);
      return next;
    });
  };

  useEffect(() => {
    setStandalone(isStandaloneApp());
    const loaded = getWorkouts();
    setWorkouts(loaded);
    setStreak(computeStreak(getCompletedDayKeys()));
    const history = getCompletedWorkouts();
    setCompletedWorkouts(history);
    setTotalCompleted(history.length);
    const programState = getProgramState();
    setPrograms(programState.programs);
    setActiveProgramId(programState.activeProgramId);
    setProgramProgress(programState.progressByProgramId ?? {});

    // Most recently completed workout, for the "repeat" quick-start.
    const recent = [...history].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];
    setLastWorkoutId(recent?.workoutId ?? null);

    // First-run onboarding: only when the user hasn't seen it and has no
    // workouts yet. Read after mount to avoid hydration mismatches.
    if (!getSettings().onboardingDone && loaded.length === 0) {
      setShowOnboarding(true);
    }
  }, []);

  const showIncomingShare = useCallback(
    (
      incoming: IncomingShare,
      reference: SharedImportReference,
      sourceUrl?: string
    ) => {
      setPendingShareLink(
        sourceUrl ?? buildSharedImportUrl(reference, window.location.origin)
      );
      if (incoming.kind === "program") {
        setPendingImport(null);
        setPendingCustom([]);
        setPendingProgramImport(incoming.decoded);
        return;
      }
      setPendingProgramImport(null);
      setPendingImport(incoming.decoded.workout);
      setPendingCustom(incoming.decoded.customExercises);
    },
    []
  );

  // Detect direct share links and operating-system PWA share-target launches.
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const fromShareTarget = search.get("shareTarget") === "1";
    const hasHandoff = search.has("shareHandoff");
    const handoff = consumeShareHandoff(search.get("shareHandoff"));
    const candidates = [
      window.location.href,
      search.get("sharedUrl"),
      search.get("sharedText"),
    ];
    const shortShare = candidates
      .map(extractShortShare)
      .find((candidate) => candidate !== null);
    const reference =
      handoff?.reference ??
      candidates
        .map(extractSharedImport)
        .find((candidate): candidate is SharedImportReference => candidate !== null);

    if (!reference && !shortShare && !fromShareTarget && !hasHandoff) return;

    // Remove handoff parameters before showing a dialog so refresh never
    // repeats an import and the address bar does not retain the shared payload.
    const cleanUrl = new URL(window.location.href);
    cleanUrl.hash = "";
    ["shareTarget", "sharedTitle", "sharedText", "sharedUrl", "shareHandoff"].forEach(
      (key) => cleanUrl.searchParams.delete(key)
    );
    window.history.replaceState(
      null,
      "",
      `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`
    );

    if (shortShare && !reference) {
      window.location.replace(buildShortShareUrl(shortShare, window.location.origin));
      return;
    }
    if (!reference) {
      toast.error("No ForkWorkout share link was found.");
      return;
    }
    const incoming = decodeIncomingShare(reference);
    if (incoming) showIncomingShare(incoming, reference, handoff?.sourceUrl);
    else toast.error(`That shared ${reference.kind} link looks invalid.`);
  }, [showIncomingShare]);

  const handleEdit = (id: string) => router.push(ROUTES.editWorkout(id));
  const handleStart = (id: string) => router.push(ROUTES.startWorkout(id));

  const handleCopy = (id: string) => {
    const copy = duplicateWorkout(id);
    if (copy) {
      setWorkouts((prev) => [...prev, copy]);
      toast.success(`Copied to “${copy.title}”`);
    }
  };

  const resetShareQr = () => {
    qrRequestRef.current += 1;
    setShareMethod("link");
    setShareQrUrl(null);
    setShareQrLoading(false);
    setShareQrError(null);
  };

  const handleShare = (id: string) => {
    const workout = workouts.find((w) => w.id === id);
    if (!workout) return;
    resetShareQr();
    setShareMessage("");
    setShareTarget(workout);
  };

  const handleProgramShare = (program: WorkoutProgram) => {
    resetShareQr();
    setShareMessage("");
    setProgramShareTarget(program);
  };

  const closeShareDialog = () => {
    resetShareQr();
    setShareTarget(null);
    setProgramShareTarget(null);
  };

  const updateShareMessage = (message: string) => {
    setShareMessage(message);
    setShareQrUrl(null);
    setShareQrError(null);
  };

  const generateShareQr = async () => {
    const workoutTarget = shareTarget;
    const programTarget = programShareTarget;
    if (!workoutTarget && !programTarget) return;

    const encoded = workoutTarget
      ? encodeWorkout(workoutTarget, shareMessage, MAX_SHARE_PAYLOAD_BYTES)
      : encodeProgram(
          programTarget as WorkoutProgram,
          workouts,
          shareMessage,
          MAX_SHARE_PAYLOAD_BYTES
        );
    if (!encoded) {
      setShareQrError("This workout or program is too large to share (maximum 256 KB).");
      return;
    }

    const requestId = qrRequestRef.current + 1;
    qrRequestRef.current = requestId;
    setShareQrLoading(true);
    setShareQrError(null);
    setShareQrUrl(null);
    try {
      const url = await createCloudShare(
        { kind: workoutTarget ? "workout" : "program", encoded },
        window.location.origin
      );
      if (qrRequestRef.current === requestId) setShareQrUrl(url);
    } catch (reason) {
      if (qrRequestRef.current === requestId) {
        setShareQrError(
          reason instanceof Error
            ? reason.message
            : "The QR code could not be created. Try again."
        );
      }
    } finally {
      if (qrRequestRef.current === requestId) setShareQrLoading(false);
    }
  };

  const changeShareMethod = (method: ShareMethod) => {
    setShareMethod(method);
    if (method === "qr" && !shareQrUrl && !shareQrLoading) {
      void generateShareQr();
    }
  };

  const copyQrLink = async () => {
    if (!shareQrUrl) return;
    if (await copyText(shareQrUrl)) toast.success("Share link copied to clipboard");
    else toast.error("Couldn't copy the share link.");
  };

  const doShare = async () => {
    if (!shareTarget) return;
    const target = shareTarget;
    const encoded = encodeWorkout(target, shareMessage, MAX_SHARE_PAYLOAD_BYTES);
    if (!encoded) {
      toast.error("This workout is too large to share (maximum 256 KB).");
      return;
    }
    closeShareDialog();
    try {
      const result = await deliverSharedReference({
        reference: { kind: "workout", encoded },
        legacyUrl: buildShareUrl(target, window.location.origin, shareMessage),
        title: target.title || "ForkWorkout",
        text:
          shareMessage.trim() ||
          `Check out my “${target.title || "workout"}” on ForkWorkout`,
        origin: window.location.origin,
      });
      if (result.method === "clipboard") {
        toast.success(
          result.usedCloud
            ? "Short share link copied to clipboard"
            : "Share link copied to clipboard"
        );
      } else if (result.method === "download") {
        toast.info("Sharing service unavailable — a portable workout file was downloaded.");
      }
    } catch {
      toast.error("Couldn't share this workout.");
    }
  };

  const dismissWorkoutImport = () => {
    setPendingImport(null);
    setPendingCustom([]);
    setPendingShareLink(null);
  };

  const dismissProgramImport = () => {
    setPendingProgramImport(null);
    setPendingShareLink(null);
  };

  const copyImportForInstalledApp = async () => {
    if (!pendingShareLink) return;
    if (await copyText(pendingShareLink)) {
      toast.success("Shared link copied", {
        description: "Open ForkWorkout from your Home Screen, then tap Import workout or program.",
      });
    } else {
      toast.error("Couldn't copy the link. Select and copy it manually instead.");
    }
  };

  const confirmImport = () => {
    if (!pendingImport) return;
    // Register any bundled custom exercises we don't already have (by name), so
    // the recipient gets their how-to / video / units too.
    if (pendingCustom.length > 0) {
      const have = new Set(getCustomExercises().map((e) => e.name.toLowerCase()));
      for (const cx of pendingCustom) {
        if (!have.has(cx.name.toLowerCase())) addCustomExercise(cx);
      }
    }
    const title = uniqueWorkoutTitle(
      pendingImport.title,
      workouts.map((w) => w.title)
    );
    const imported = { ...pendingImport, title };
    upsertWorkout(imported);
    setWorkouts((prev) => [...prev, imported]);
    toast.success(`Added “${imported.title}” to your workouts`);
    setPendingImport(null);
    setPendingCustom([]);
    setPendingShareLink(null);
  };

  const handleAddTemplate = (template: WorkoutTemplate) => {
    const workout = instantiateTemplate(template);
    upsertWorkout(workout);
    setWorkouts((prev) => [...prev, workout]);
    toast.success(`Added “${workout.title}”`, {
      action: {
        label: "Start",
        onClick: () => router.push(ROUTES.startWorkout(workout.id)),
      },
    });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteWorkout(pendingDelete.id);
    removeWorkoutFromPrograms(pendingDelete.id);
    setWorkouts((prev) => prev.filter((w) => w.id !== pendingDelete.id));
    const nextState = getProgramState();
    setPrograms(nextState.programs);
    setActiveProgramId(nextState.activeProgramId);
    setProgramProgress(nextState.progressByProgramId ?? {});
    toast.success(`Deleted “${pendingDelete.title || "workout"}”`);
    setPendingDelete(null);
  };

  const openNewProgram = () => {
    setEditingProgram(null);
    setProgramDialogOpen(true);
  };

  const saveProgram = (value: { title: string; workoutIds: string[] }) => {
    if (editingProgram) {
      upsertProgram({ ...editingProgram, ...value });
      toast.success(`Updated “${value.title}”`);
    } else {
      const created = createProgram(value.title, value.workoutIds);
      if (!created) {
        toast.error("Couldn't create that program.");
        return;
      }
      toast.success(`Created “${created.title}”`);
    }
    const state = getProgramState();
    setPrograms(state.programs);
    setActiveProgramId(state.activeProgramId);
    setProgramProgress(state.progressByProgramId ?? {});
    setProgramDialogOpen(false);
    setEditingProgram(null);
  };

  const activateProgram = (id: string) => {
    if (!setActiveProgram(id)) return;
    setActiveProgramId(id);
    const program = programs.find((item) => item.id === id);
    if (program) toast.success(`“${program.title}” is now active`);
  };

  const skipProgramWorkout = () => {
    if (!activeProgram || !nextProgramWorkout || nextProgramWorkout.total < 2) return;
    const previousProgress = programProgress[activeProgram.id];
    const result = skipNextProgramWorkout(activeProgram.id, workouts, completedWorkouts);
    if (!result) {
      toast.error("Couldn't skip that workout.");
      return;
    }
    setProgramProgress(result.state.progressByProgramId ?? {});
    toast.success(`Skipped “${result.skipped.title}”`, {
      description: `Up next: ${result.next.title}`,
      action: {
        label: "Undo",
        onClick: () => {
          const current = getProgramState();
          const progressByProgramId = { ...current.progressByProgramId };
          if (previousProgress) progressByProgramId[activeProgram.id] = previousProgress;
          else delete progressByProgramId[activeProgram.id];
          if (saveProgramState({ ...current, progressByProgramId })) {
            setProgramProgress(getProgramState().progressByProgramId ?? {});
          }
        },
      },
    });
  };

  const confirmProgramDelete = () => {
    if (!pendingProgramDelete) return;
    deleteProgram(pendingProgramDelete.id);
    const state = getProgramState();
    setPrograms(state.programs);
    setActiveProgramId(state.activeProgramId);
    setProgramProgress(state.progressByProgramId ?? {});
    toast.success(`Deleted “${pendingProgramDelete.title}”`);
    setPendingProgramDelete(null);
  };

  const doShareProgram = async () => {
    if (!programShareTarget) return;
    const target = programShareTarget;
    const encoded = encodeProgram(target, workouts, shareMessage, MAX_SHARE_PAYLOAD_BYTES);
    if (!encoded) {
      toast.error("This program is too large to share (maximum 256 KB).");
      return;
    }
    closeShareDialog();
    try {
      const result = await deliverSharedReference({
        reference: { kind: "program", encoded },
        legacyUrl: buildProgramShareUrl(
          target,
          workouts,
          window.location.origin,
          shareMessage
        ),
        title: target.title,
        text: shareMessage.trim() || `Try my “${target.title}” program on ForkWorkout`,
        origin: window.location.origin,
      });
      if (result.method === "clipboard") {
        toast.success(
          result.usedCloud
            ? "Short program link copied to clipboard"
            : "Program link copied to clipboard"
        );
      } else if (result.method === "download") {
        toast.info("Sharing service unavailable — a portable program file was downloaded.");
      }
    } catch {
      toast.error("Couldn't share this program.");
    }
  };

  const confirmProgramImport = () => {
    if (!pendingProgramImport) return;
    const have = new Set(getCustomExercises().map((exercise) => exercise.name.toLowerCase()));
    for (const exercise of pendingProgramImport.customExercises) {
      if (!have.has(exercise.name.toLowerCase())) addCustomExercise(exercise);
    }
    const existingTitles = workouts.map((workout) => workout.title);
    const importedWorkouts = pendingProgramImport.workouts.map((workout) => {
      const title = uniqueWorkoutTitle(workout.title, existingTitles);
      existingTitles.push(title);
      return { ...workout, title };
    });
    saveWorkouts([...workouts, ...importedWorkouts]);
    const state = getProgramState();
    const importedProgram = pendingProgramImport.program;
    saveProgramState({
      ...state,
      activeProgramId: state.activeProgramId ?? importedProgram.id,
      programs: [...state.programs, importedProgram],
    });
    setWorkouts((current) => [...current, ...importedWorkouts]);
    const nextState = getProgramState();
    setPrograms(nextState.programs);
    setActiveProgramId(nextState.activeProgramId);
    setProgramProgress(nextState.progressByProgramId ?? {});
    toast.success(`Imported “${importedProgram.title}” with ${importedWorkouts.length} workouts`);
    setPendingProgramImport(null);
    setPendingShareLink(null);
  };

  const handleClearAll = async () => {
    await clearAllData({ keepCustomExercises });
    setWorkouts([]);
    setStreak(0);
    setTotalCompleted(0);
    setCompletedWorkouts([]);
    setPrograms([]);
    setActiveProgramId(undefined);
    setProgramProgress({});
    setLastWorkoutId(null);
    setShowClearAll(false);
    setShowOnboarding(true);
    toast.success(
      keepCustomExercises && hasCustomExercises()
        ? "Your data was deleted — custom exercises kept"
        : "All your data has been deleted from this device"
    );
  };

  const handleGenerated = (workout: Workout) => {
    upsertWorkout(workout);
    setWorkouts((prev) => [...prev, workout]);
    toast.success(`Created “${workout.title}” — tweak it to fit you`);
    router.push(ROUTES.editWorkout(workout.id));
  };

  const handleGeneratedProgram = (value: { title: string; workouts: Workout[] }) => {
    const existingTitles = workouts.map((workout) => workout.title);
    const generated = value.workouts.map((workout) => {
      const title = uniqueWorkoutTitle(workout.title, existingTitles);
      existingTitles.push(title);
      return { ...workout, title };
    });
    if (!saveWorkouts([...workouts, ...generated])) {
      toast.error("Couldn't save the generated program.");
      return;
    }
    const program = createProgram(
      value.title,
      generated.map((workout) => workout.id)
    );
    if (!program) {
      // Workouts are still safely saved and remain usable individually.
      setWorkouts((current) => [...current, ...generated]);
      toast.error("The workouts were saved, but the program couldn't be created.");
      return;
    }
    setActiveProgram(program.id);
    const state = getProgramState();
    setWorkouts((current) => [...current, ...generated]);
    setPrograms(state.programs);
    setActiveProgramId(state.activeProgramId);
    setProgramProgress(state.progressByProgramId ?? {});
    setShowWizard(false);
    toast.success(`Created “${program.title}” with ${generated.length} workouts`);
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 pb-24 space-y-8">
      {/* Repeat last workout — one-tap quick start */}
      {jumpWorkout && (
        <Card className="border-primary/30 bg-primary/5 py-0">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Jump back in</p>
              <p className="truncate text-lg font-semibold">{jumpWorkout.title}</p>
              {activeProgram && nextProgramWorkout && (
                <p className="text-xs text-primary">
                  {activeProgram.title} · workout {nextProgramWorkout.position + 1} of{" "}
                  {nextProgramWorkout.total}
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {activeProgram && nextProgramWorkout && nextProgramWorkout.total > 1 && (
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={skipProgramWorkout}
                  aria-label={`Skip ${jumpWorkout.title} in ${activeProgram.title}`}
                >
                  <SkipForward className="size-4" />
                  Skip
                </Button>
              )}
              <Button className="gap-1.5" onClick={() => handleStart(jumpWorkout.id)}>
                <Play className="size-4" />
                Start
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress summary */}
      <div className="space-y-3">
        <WeeklyGoalCard key={`goal-${totalCompleted}`} />
        <Link href={ROUTES.history} className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Day streak"
              value={streak}
              icon={<Flame className="size-5" />}
            />
            <StatCard
              label="Workouts done"
              value={totalCompleted}
              icon={<Trophy className="size-5" />}
            />
          </div>
        </Link>
        <Button
          asChild
          variant="outline"
          className="w-full gap-2"
        >
          <Link href={ROUTES.history}>
            <CalendarDays className="size-4" />
            View calendar &amp; history
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full gap-2">
          <Link href={ROUTES.body}>
            <Scale className="size-4" />
            Body metrics
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full gap-2">
          <Link href={ROUTES.exercises}>
            <Dumbbell className="size-4" />
            Browse &amp; manage exercises
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={() => setImportShareOpen(true)}
        >
          <ScanLine className="size-4" />
          Import workout or program
        </Button>
      </div>

      {/* Programs */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-3xl">{honkFont("Your Programs")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Group workouts into a rotation and always know what comes next.
            </p>
          </div>
          {workouts.length > 0 && (
            <Button size="sm" className="shrink-0 gap-1.5" onClick={openNewProgram}>
              <Plus className="size-4" /> Program
            </Button>
          )}
        </div>
        {programs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex items-center gap-3">
              <Layers3 className="size-7 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Build a workout rotation</p>
                <p className="text-sm text-muted-foreground">
                  Combine workouts like Push, Pull, Legs, and Abs.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {programs.map((program) => (
              <ProgramCard
                key={program.id}
                program={program}
                workouts={workouts}
                active={program.id === activeProgramId}
                nextWorkout={
                  getNextProgramWorkout(
                    program,
                    workouts,
                    completedWorkouts,
                    programProgress[program.id]
                  )?.workout ?? null
                }
                onActivate={() => activateProgram(program.id)}
                onStart={handleStart}
                onEdit={() => {
                  setEditingProgram(program);
                  setProgramDialogOpen(true);
                }}
                onShare={() => handleProgramShare(program)}
                onDelete={() => setPendingProgramDelete(program)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Your workouts */}
      <section className="space-y-4">
        <div className="space-y-3">
          <h2 className="text-3xl">{honkFont("Your Workouts")}</h2>
          <div className="flex flex-wrap items-center gap-2">
            {workouts.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setReorderOpen(true)}
              >
                <ArrowUpDown className="size-4" />
                Reorder
              </Button>
            )}
            <Button
              variant="secondary"
              className="gap-2"
              onClick={() => setShowWizard(true)}
            >
              <Sparkles className="size-4" />
              Help me create
            </Button>
          </div>
        </div>

        {workouts.length === 0 ? (
          <EmptyState
            icon={<Dumbbell className="size-8" />}
            title="No workouts yet"
            description="Create your first routine and ForkWorkout will save it on this device — no account needed."
            action={
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button className="gap-2" onClick={() => router.push(ROUTES.newWorkout)}>
                  <Plus className="size-4" />
                  Create your first workout
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => setShowWizard(true)}
                >
                  <Sparkles className="size-4" />
                  Help me create one
                </Button>
              </div>
            }
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {workouts.map((workout) => (
              <li key={workout.id}>
                <WorkoutCard
                  workout={workout}
                  onStart={handleStart}
                  onPreview={(selectedWorkout) => {
                    setPreviewWorkout(selectedWorkout);
                    setPreviewOpen(true);
                  }}
                  onEdit={handleEdit}
                  onDelete={() => setPendingDelete(workout)}
                  onCopy={handleCopy}
                  onShare={handleShare}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Starter workouts */}
      <section className="space-y-4">
        <div>
          <h2 className="text-3xl">{honkFont("Starter Workouts")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            New here? Add a ready-made routine and tweak it to fit you.
          </p>
        </div>
        <StarterWorkouts onAdd={handleAddTemplate} />
      </section>

      {/* Danger zone */}
      <section className="space-y-3 border-t border-border pt-6">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground">Your data</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            ForkWorkout stores everything locally on this device. You can wipe it
            all at any time.
          </p>
        </div>
        <Button
          variant="outline"
          className="w-full gap-2 text-destructive hover:text-destructive"
          onClick={() => setShowClearAll(true)}
        >
          <Trash2 className="size-4" />
          Delete your data
        </Button>
      </section>

      <footer className="pt-2 text-center text-xs text-muted-foreground">
        <a
          href={FEEDBACK_MAILTO}
          className="underline underline-offset-4 hover:text-foreground"
        >
          Send feedback
        </a>
        <span className="mx-2" aria-hidden>
          ·
        </span>
        <Link
          href={ROUTES.credits}
          className="underline underline-offset-4 hover:text-foreground"
        >
          Credits &amp; licenses
        </Link>
      </footer>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete this workout?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={pendingProgramDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingProgramDelete(null);
        }}
        title="Delete this program?"
        description="The workouts stay in your library. Only the program grouping is removed."
        confirmLabel="Delete program"
        destructive
        onConfirm={confirmProgramDelete}
      />

      {/* Delete all data — with an option to keep custom exercises */}
      <Dialog open={showClearAll} onOpenChange={setShowClearAll}>
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] min-w-0 max-w-sm flex-col overflow-hidden">
          <DialogHeader className="min-w-0 shrink-0 text-left">
            <DialogTitle>Delete all your data?</DialogTitle>
            <DialogDescription>
              This permanently removes every workout, completed-workout history, body
              data, equipment, preferences, settings, backups, and any in-progress session
              from this device. Onboarding will start again. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {hasCustomExercises() && (
            <label className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-3 text-sm">
              <input
                type="checkbox"
                checked={keepCustomExercises}
                onChange={(e) => setKeepCustomExercises(e.target.checked)}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>
                <span className="font-medium">Keep my custom exercises</span>
                <span className="block text-xs text-muted-foreground">
                  Your added exercises stay so you don&apos;t have to recreate them.
                </span>
              </span>
            </label>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowClearAll(false)}>
              Cancel
            </Button>
            <Button variant="destructive" className="flex-1" onClick={handleClearAll}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WorkoutWizard
        open={showWizard}
        onOpenChange={setShowWizard}
        onGenerate={handleGenerated}
        onGenerateProgram={handleGeneratedProgram}
      />

      <ProgramDialog
        open={programDialogOpen}
        onOpenChange={(open) => {
          setProgramDialogOpen(open);
          if (!open) setEditingProgram(null);
        }}
        workouts={workouts}
        program={editingProgram}
        onSave={saveProgram}
      />

      <ReorderExercisesDialog
        open={reorderOpen}
        onOpenChange={setReorderOpen}
        title="Reorder workouts"
        description="Drag the handles to reorder your workouts."
        items={workouts.map((w) => ({ id: w.id, title: w.title || "Untitled workout" }))}
        onMove={moveWorkout}
      />

      <WorkoutPreviewDialog
        open={previewOpen}
        workout={previewWorkout}
        onOpenChange={setPreviewOpen}
        onStart={handleStart}
      />

      <OnboardingDialog
        open={showOnboarding}
        onOpenChange={setShowOnboarding}
        onComplete={({ addedWorkout, openWizard }) => {
          if (addedWorkout) {
            setWorkouts((prev) => [...prev, addedWorkout]);
            toast.success(`Added “${addedWorkout.title}”`, {
              action: {
                label: "Start",
                onClick: () => router.push(ROUTES.startWorkout(addedWorkout.id)),
              },
            });
          }
          // Open the guided builder once onboarding has fully closed (avoids
          // overlapping dialog focus traps).
          if (openWizard) {
            setTimeout(() => setShowWizard(true), 150);
          }
        }}
      />

      {/* Share a workout — add an optional message, then send the link */}
      <Dialog
        open={shareTarget !== null}
        onOpenChange={(open) => !open && closeShareDialog()}
      >
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] max-w-sm flex-col overflow-hidden">
          <DialogHeader className="text-left">
            <DialogTitle>Share this workout?</DialogTitle>
            <DialogDescription>
              Send a link or let another ForkWorkout user scan a QR code.
            </DialogDescription>
          </DialogHeader>
          {shareTarget && (
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="font-semibold">{shareTarget.title}</p>
              <p className="text-sm text-muted-foreground">
                {shareTarget.exercises.length} exercise
                {shareTarget.exercises.length === 1 ? "" : "s"}
              </p>
            </div>
          )}
          <div className="min-h-0 overflow-y-auto">
            <ShareMethodTabs
              method={shareMethod}
              onMethodChange={changeShareMethod}
              message={shareMessage}
              onMessageChange={updateShareMessage}
              messageId="share-msg"
              messagePlaceholder="e.g. Try this leg day — brutal but worth it 🔥"
              shareLabel="Share"
              qrTitle="ForkWorkout shared workout QR code"
              onShare={doShare}
              onClose={closeShareDialog}
              qrUrl={shareQrUrl}
              qrLoading={shareQrLoading}
              qrError={shareQrError}
              onGenerateQr={generateShareQr}
              onCopyQrLink={copyQrLink}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Share a complete program and its workouts. */}
      <Dialog
        open={programShareTarget !== null}
        onOpenChange={(open) => !open && closeShareDialog()}
      >
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] max-w-sm flex-col overflow-hidden">
          <DialogHeader className="text-left">
            <DialogTitle>Share this program?</DialogTitle>
            <DialogDescription>
              Share every workout in rotation order by link or QR code.
            </DialogDescription>
          </DialogHeader>
          {programShareTarget && (
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="font-semibold">{programShareTarget.title}</p>
              <p className="text-sm text-muted-foreground">
                {programShareTarget.workoutIds.length} workout
                {programShareTarget.workoutIds.length === 1 ? "" : "s"}
              </p>
            </div>
          )}
          <div className="min-h-0 overflow-y-auto">
            <ShareMethodTabs
              method={shareMethod}
              onMethodChange={changeShareMethod}
              message={shareMessage}
              onMessageChange={updateShareMessage}
              messageId="program-share-msg"
              messagePlaceholder="e.g. Here is the full routine 🔥"
              shareLabel="Share program"
              qrTitle="ForkWorkout shared program QR code"
              onShare={doShareProgram}
              onClose={closeShareDialog}
              qrUrl={shareQrUrl}
              qrLoading={shareQrLoading}
              qrError={shareQrError}
              onGenerateQr={generateShareQr}
              onCopyQrLink={copyQrLink}
            />
          </div>
        </DialogContent>
      </Dialog>

      <ImportShareDialog open={importShareOpen} onOpenChange={setImportShareOpen} />

      {/* Import a complete shared program. */}
      <Dialog
        open={pendingProgramImport !== null}
        onOpenChange={(open) => !open && dismissProgramImport()}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader className="text-left">
            <DialogTitle>Import this program?</DialogTitle>
            <DialogDescription>
              All included workouts will be added to this local library in rotation order.
            </DialogDescription>
          </DialogHeader>
          {pendingProgramImport && (
            <div className="space-y-3">
              {!standalone && pendingShareLink && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  <p className="font-medium">Using the Home Screen app?</p>
                  <p className="mt-1 text-muted-foreground">
                    Your browser and installed app save separately. Copy this link,
                    open ForkWorkout from your Home Screen, then tap Import workout or program.
                  </p>
                  <Input
                    readOnly
                    value={pendingShareLink}
                    onFocus={(event) => event.currentTarget.select()}
                    onClick={(event) => event.currentTarget.select()}
                    className="mt-2 h-8 bg-background/70 text-xs"
                    aria-label="Shared program link for manual copying"
                  />
                </div>
              )}
              {pendingProgramImport.message && (
                <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm italic">
                  “{pendingProgramImport.message}”
                </p>
              )}
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="font-semibold">{pendingProgramImport.program.title}</p>
                <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {pendingProgramImport.workouts.map((workout, index) => (
                    <li key={workout.id}>{index + 1}. {workout.title}</li>
                  ))}
                </ol>
              </div>
            </div>
          )}
          {!standalone && pendingShareLink ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Button className="gap-1.5 sm:col-span-2" onClick={copyImportForInstalledApp}>
                <Copy className="size-4" /> Copy for Home Screen app
              </Button>
              <Button variant="outline" onClick={dismissProgramImport}>
                Not now
              </Button>
              <Button variant="outline" onClick={confirmProgramImport}>
                <Download className="size-4" /> Import in browser
              </Button>
            </div>
          ) : (
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={dismissProgramImport}>
                No thanks
              </Button>
              <Button className="gap-1.5" onClick={confirmProgramImport}>
                <Download className="size-4" /> Import program
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Import a shared workout */}
      <Dialog
        open={pendingImport !== null}
        onOpenChange={(open) => !open && dismissWorkoutImport()}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader className="text-left">
            <DialogTitle>Import this workout?</DialogTitle>
            <DialogDescription>
              Someone shared a workout with you. Add it to this local library?
            </DialogDescription>
          </DialogHeader>
          {pendingImport && (
            <div className="space-y-3">
              {!standalone && pendingShareLink && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  <p className="font-medium">Using the Home Screen app?</p>
                  <p className="mt-1 text-muted-foreground">
                    Your browser and installed app save separately. Copy this link,
                    open ForkWorkout from your Home Screen, then tap Import workout or program.
                  </p>
                  <Input
                    readOnly
                    value={pendingShareLink}
                    onFocus={(event) => event.currentTarget.select()}
                    onClick={(event) => event.currentTarget.select()}
                    className="mt-2 h-8 bg-background/70 text-xs"
                    aria-label="Shared workout link for manual copying"
                  />
                </div>
              )}
              {pendingImport.sharedMessage && (
                <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm italic text-foreground">
                  “{pendingImport.sharedMessage}”
                </p>
              )}
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="font-semibold">{pendingImport.title}</p>
                <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                  {pendingImport.exercises.slice(0, 6).map((ex, i) => (
                    <li key={i} className="truncate">
                      • {ex.name} · {ex.sets.length} set{ex.sets.length === 1 ? "" : "s"}
                    </li>
                  ))}
                  {pendingImport.exercises.length > 6 && (
                    <li>+{pendingImport.exercises.length - 6} more…</li>
                  )}
                </ul>
              </div>
              {pendingCustom.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Includes {pendingCustom.length} custom exercise
                  {pendingCustom.length === 1 ? "" : "s"} (with how-to &amp; video).
                </p>
              )}
            </div>
          )}
          {!standalone && pendingShareLink ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Button className="gap-1.5 sm:col-span-2" onClick={copyImportForInstalledApp}>
                <Copy className="size-4" /> Copy for Home Screen app
              </Button>
              <Button variant="outline" onClick={dismissWorkoutImport}>
                Not now
              </Button>
              <Button variant="outline" onClick={confirmImport}>
                <Download className="size-4" /> Import in browser
              </Button>
            </div>
          ) : (
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" className="flex-1" onClick={dismissWorkoutImport}>
                No thanks
              </Button>
              <Button className="flex-1 gap-1" onClick={confirmImport}>
                <Download className="size-4" />
                Import
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkoutList;
