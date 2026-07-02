"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Download, Dumbbell, Flame, Plus, Scale, Sparkles, Trash2, Trophy } from "lucide-react";

import { honkFont } from "@/lib/honkFont";
import { Button } from "@/components/ui/button";
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
import { WorkoutWizard } from "@/components/workouts/WorkoutWizard";
import { getWorkouts, deleteWorkout, upsertWorkout, duplicateWorkout } from "@/lib/storage/workout-storage";
import { getCompletedDayKeys, getCompletedWorkouts } from "@/lib/storage/history-storage";
import { buildShareUrl, decodeWorkout } from "@/lib/storage/share";
import { clearAllData } from "@/lib/storage/reset";
import { computeStreak } from "@/lib/date/streak";
import { instantiateTemplate, type WorkoutTemplate } from "@/lib/templates";
import { ROUTES } from "@/lib/routes";
import type { Workout } from "@/lib/types";
import { toast } from "sonner";

const WorkoutList = () => {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [streak, setStreak] = useState(0);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<Workout | null>(null);
  const [showClearAll, setShowClearAll] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [pendingImport, setPendingImport] = useState<Workout | null>(null);

  useEffect(() => {
    setWorkouts(getWorkouts());
    setStreak(computeStreak(getCompletedDayKeys()));
    setTotalCompleted(getCompletedWorkouts().length);
  }, []);

  // Detect a shared workout in the URL fragment (#import=…) and offer to import.
  useEffect(() => {
    const match = window.location.hash.match(/[#&]import=([^&]+)/);
    if (!match) return;
    const decoded = decodeWorkout(match[1]);
    // Clear the fragment so a refresh doesn't re-prompt.
    history.replaceState(null, "", window.location.pathname + window.location.search);
    if (decoded) setPendingImport(decoded);
    else toast.error("That shared workout link looks invalid.");
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

  const handleShare = async (id: string) => {
    const workout = workouts.find((w) => w.id === id);
    if (!workout) return;
    const url = buildShareUrl(workout, window.location.origin);
    if (!url) {
      toast.error("This workout is too large to share by link — use Export instead.");
      return;
    }
    const shareData = {
      title: workout.title || "ForkWorkout",
      text: `Check out my “${workout.title || "workout"}” on ForkWorkout`,
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
    } catch {
      // user cancelled or share failed — fall through to clipboard
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
    upsertWorkout(pendingImport);
    setWorkouts((prev) => [...prev, pendingImport]);
    toast.success(`Added “${pendingImport.title}” to your workouts`);
    setPendingImport(null);
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
    clearAllData();
    setWorkouts([]);
    setStreak(0);
    setTotalCompleted(0);
    setShowClearAll(false);
    toast.success("All your data has been deleted from this device");
  };

  const handleGenerated = (workout: Workout) => {
    upsertWorkout(workout);
    setWorkouts((prev) => [...prev, workout]);
    toast.success(`Created “${workout.title}” — tweak it to fit you`);
    router.push(ROUTES.editWorkout(workout.id));
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6 space-y-8">
      {/* Progress summary */}
      <div className="space-y-3">
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
      </div>

      {/* Your workouts */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-3xl">{honkFont("Your Workouts")}</h2>
          <Button variant="secondary" className="gap-2" onClick={() => setShowWizard(true)}>
            <Sparkles className="size-4" />
            Help me create
          </Button>
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

      <ConfirmDialog
        open={showClearAll}
        onOpenChange={setShowClearAll}
        title="Delete all your data?"
        description="This permanently removes every workout, your completed-workout history, and any in-progress session from this device. This cannot be undone."
        confirmLabel="Delete everything"
        destructive
        onConfirm={handleClearAll}
      />

      <WorkoutWizard open={showWizard} onOpenChange={setShowWizard} onGenerate={handleGenerated} />

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
