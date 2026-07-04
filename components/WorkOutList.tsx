"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Download, Dumbbell, Flame, Play, Plus, Scale, Share2, Sparkles, Trash2, Trophy, ArrowUpDown } from "lucide-react";

import { honkFont } from "@/lib/honkFont";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
import { StarterWorkouts } from "@/components/workouts/StarterWorkouts";
import { WeeklyGoalCard } from "@/components/dashboard/WeeklyGoalCard";
import { OnboardingDialog } from "@/components/onboarding/OnboardingDialog";
import { ReorderExercisesDialog } from "@/components/exercises/ReorderExercisesDialog";
import { WorkoutWizard } from "@/components/workouts/WorkoutWizard";
import { getWorkouts, deleteWorkout, upsertWorkout, duplicateWorkout, uniqueWorkoutTitle, saveWorkouts } from "@/lib/storage/workout-storage";
import { getCompletedDayKeys, getCompletedWorkouts } from "@/lib/storage/history-storage";
import { buildShareUrl, decodeWorkout } from "@/lib/storage/share";
import { clearAllData } from "@/lib/storage/reset";
import { hasCustomExercises, getCustomExercises, addCustomExercise } from "@/lib/storage/custom-exercises";
import { computeStreak } from "@/lib/date/streak";
import { getSettings } from "@/lib/storage/settings";
import { instantiateTemplate, type WorkoutTemplate } from "@/lib/templates";
import { ROUTES } from "@/lib/routes";
import type { Workout } from "@/lib/types";
import { toast } from "sonner";

type AddCustomInput = Parameters<typeof addCustomExercise>[0];

const WorkoutList = () => {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [streak, setStreak] = useState(0);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<Workout | null>(null);
  const [showClearAll, setShowClearAll] = useState(false);
  const [keepCustomExercises, setKeepCustomExercises] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [pendingImport, setPendingImport] = useState<Workout | null>(null);
  const [pendingCustom, setPendingCustom] = useState<AddCustomInput[]>([]);
  const [shareTarget, setShareTarget] = useState<Workout | null>(null);
  const [shareMessage, setShareMessage] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [lastWorkoutId, setLastWorkoutId] = useState<string | null>(null);

  // Derive from current workouts so the card hides if that workout is deleted.
  const lastWorkout = lastWorkoutId
    ? workouts.find((w) => w.id === lastWorkoutId) ?? null
    : null;

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
    const loaded = getWorkouts();
    setWorkouts(loaded);
    setStreak(computeStreak(getCompletedDayKeys()));
    const history = getCompletedWorkouts();
    setTotalCompleted(history.length);

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

  // Detect a shared workout in the URL fragment (#import=…) and offer to import.
  useEffect(() => {
    const match = window.location.hash.match(/[#&]import=([^&]+)/);
    if (!match) return;
    const decoded = decodeWorkout(match[1]);
    // Clear the fragment so a refresh doesn't re-prompt.
    history.replaceState(null, "", window.location.pathname + window.location.search);
    if (decoded) {
      setPendingImport(decoded.workout);
      setPendingCustom(decoded.customExercises);
    } else toast.error("That shared workout link looks invalid.");
  }, []);

  const handleEdit = (id: string) => router.push(ROUTES.editWorkout(id));
  const handleStart = (id: string) => router.push(ROUTES.startWorkout(id));

  const handleCopy = (id: string) => {
    const copy = duplicateWorkout(id);
    if (copy) {
      setWorkouts((prev) => [...prev, copy]);
      toast.success(`Copied to “${copy.title}”`);
    }
  };

  const handleShare = (id: string) => {
    const workout = workouts.find((w) => w.id === id);
    if (!workout) return;
    setShareMessage("");
    setShareTarget(workout);
  };

  const doShare = async () => {
    if (!shareTarget) return;
    const url = buildShareUrl(shareTarget, window.location.origin, shareMessage);
    if (!url) {
      toast.error("This workout is too large to share by link — use Export instead.");
      return;
    }
    setShareTarget(null);
    const shareData = {
      title: shareTarget.title || "ForkWorkout",
      text: shareMessage.trim()
        ? shareMessage.trim()
        : `Check out my “${shareTarget.title || "workout"}” on ForkWorkout`,
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
    } catch {
      // user cancelled or share failed — don't fall back to clipboard
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard");
    } catch {
      toast.error("Couldn't copy the link.");
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
    setWorkouts((prev) => prev.filter((w) => w.id !== pendingDelete.id));
    toast.success(`Deleted “${pendingDelete.title || "workout"}”`);
    setPendingDelete(null);
  };

  const handleClearAll = () => {
    clearAllData({ keepCustomExercises });
    setWorkouts([]);
    setStreak(0);
    setTotalCompleted(0);
    setShowClearAll(false);
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

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 pb-24 space-y-8">
      {/* Repeat last workout — one-tap quick start */}
      {lastWorkout && (
        <Card className="border-primary/30 bg-primary/5 py-0">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Jump back in</p>
              <p className="truncate text-lg font-semibold">{lastWorkout.title}</p>
            </div>
            <Button className="shrink-0 gap-1.5" onClick={() => handleStart(lastWorkout.id)}>
              <Play className="size-4" />
              Start
            </Button>
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
            Create &amp; edit your exercises
          </Link>
        </Button>
      </div>

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
            <Button variant="secondary" className="gap-2" onClick={() => setShowWizard(true)}>
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
                <Button variant="outline" className="gap-2" onClick={() => setShowWizard(true)}>
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

      {/* Delete all data — with an option to keep custom exercises */}
      <Dialog open={showClearAll} onOpenChange={setShowClearAll}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="text-left">
            <DialogTitle>Delete all your data?</DialogTitle>
            <DialogDescription>
              This permanently removes every workout, your completed-workout history, body
              metrics, and any in-progress session from this device. This cannot be undone.
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

      <WorkoutWizard open={showWizard} onOpenChange={setShowWizard} onGenerate={handleGenerated} />

      <ReorderExercisesDialog
        open={reorderOpen}
        onOpenChange={setReorderOpen}
        title="Reorder workouts"
        description="Drag the handles to reorder your workouts."
        items={workouts.map((w) => ({ id: w.id, title: w.title || "Untitled workout" }))}
        onMove={moveWorkout}
      />

      <OnboardingDialog
        open={showOnboarding}
        onOpenChange={setShowOnboarding}
        onComplete={({ addedWorkout }) => {
          if (addedWorkout) {
            setWorkouts((prev) => [...prev, addedWorkout]);
            toast.success(`Added “${addedWorkout.title}”`, {
              action: {
                label: "Start",
                onClick: () => router.push(ROUTES.startWorkout(addedWorkout.id)),
              },
            });
          }
        }}
      />

      {/* Share a workout — add an optional message, then send the link */}
      <Dialog
        open={shareTarget !== null}
        onOpenChange={(open) => !open && setShareTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader className="text-left">
            <DialogTitle>Share this workout?</DialogTitle>
            <DialogDescription>
              Send a link to another ForkWorkout user — they can import it in one tap.
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
          <div className="space-y-1.5">
            <label htmlFor="share-msg" className="text-sm font-medium">
              Add a message to them (optional)
            </label>
            <Textarea
              id="share-msg"
              value={shareMessage}
              onChange={(e) => setShareMessage(e.target.value)}
              placeholder="e.g. Try this leg day — brutal but worth it 🔥"
              rows={3}
              maxLength={280}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShareTarget(null)}>
              Cancel
            </Button>
            <Button className="flex-1 gap-1" onClick={doShare}>
              <Share2 className="size-4" />
              Share
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import a shared workout */}
      <Dialog
        open={pendingImport !== null}
        onOpenChange={(open) => !open && setPendingImport(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader className="text-left">
            <DialogTitle>Import this workout?</DialogTitle>
            <DialogDescription>
              Someone shared a workout with you. Add it to your workouts?
            </DialogDescription>
          </DialogHeader>
          {pendingImport && (
            <div className="space-y-3">
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
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setPendingImport(null)}>
              No thanks
            </Button>
            <Button className="flex-1 gap-1" onClick={confirmImport}>
              <Download className="size-4" />
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WorkoutList;
