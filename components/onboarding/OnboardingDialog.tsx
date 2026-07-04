"use client";

import * as React from "react";
import { CalendarCheck, Check, Minus, Plus, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { STARTER_TEMPLATES, instantiateTemplate, type WorkoutTemplate } from "@/lib/templates";
import { upsertWorkout } from "@/lib/storage/workout-storage";
import { getSettings, updateSettings } from "@/lib/storage/settings";
import type { Workout } from "@/lib/types";

/**
 * First-run onboarding: welcome -> set a weekly goal -> optionally add a
 * ready-made starter workout. Marks `onboardingDone` on finish or dismiss so it
 * never shows again. Everything is persisted locally.
 */
export function OnboardingDialog({
  open,
  onOpenChange,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (result: { addedWorkout?: Workout; openWizard?: boolean }) => void;
}) {
  const [step, setStep] = React.useState(0);
  const [goal, setGoal] = React.useState(3);
  const [selected, setSelected] = React.useState<string | null>(null);
  const finishedRef = React.useRef(false);

  // Seed the goal from any existing setting when the dialog first opens.
  React.useEffect(() => {
    if (open) {
      finishedRef.current = false;
      setStep(0);
      setGoal(getSettings().weeklyGoal);
      setSelected(null);
    }
  }, [open]);

  const changeGoal = (next: number) => setGoal(Math.min(7, Math.max(1, next)));

  const finish = (template?: WorkoutTemplate, opts?: { openWizard?: boolean }) => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    updateSettings({ onboardingDone: true, weeklyGoal: goal });

    let addedWorkout: Workout | undefined;
    if (template) {
      addedWorkout = instantiateTemplate(template);
      upsertWorkout(addedWorkout);
    }
    onComplete({ addedWorkout, openWizard: opts?.openWizard });
    onOpenChange(false);
  };

  // Any close (X / escape / overlay) counts as "done" without a workout.
  const handleOpenChange = (next: boolean) => {
    if (!next) finish();
    else onOpenChange(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        {step === 0 && (
          <>
            <DialogHeader className="text-center sm:text-center">
              <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="size-7" />
              </div>
              <DialogTitle className="text-2xl">Welcome to ForkWorkout</DialogTitle>
              <DialogDescription>
                Track your workouts, beat your last numbers, and build a streak. Everything is
                saved on this device — no account, no sign-up.
              </DialogDescription>
            </DialogHeader>
            <Button className="w-full" onClick={() => setStep(1)}>
              Get started
            </Button>
          </>
        )}

        {step === 1 && (
          <>
            <DialogHeader className="text-left">
              <DialogTitle>Set a weekly goal</DialogTitle>
              <DialogDescription>
                How many days a week do you want to train? We&apos;ll track your progress on the
                dashboard.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center gap-6 py-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => changeGoal(goal - 1)}
                disabled={goal <= 1}
                aria-label="Decrease weekly goal"
              >
                <Minus className="size-5" />
              </Button>
              <div className="flex flex-col items-center">
                <CalendarCheck className="mb-1 size-6 text-primary" />
                <span className="text-4xl font-bold tabular-nums">{goal}</span>
                <span className="text-xs text-muted-foreground">days / week</span>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => changeGoal(goal + 1)}
                disabled={goal >= 7}
                aria-label="Increase weekly goal"
              >
                <Plus className="size-5" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setStep(0)}>
                Back
              </Button>
              <Button className="flex-1" onClick={() => setStep(2)}>
                Continue
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <DialogHeader className="text-left">
              <DialogTitle>Start with a ready-made workout?</DialogTitle>
              <DialogDescription>
                Let us build one for you, pick a ready-made routine, or skip and build your own.
                You can edit or delete anything later.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => finish(undefined, { openWizard: true })}
                className="flex w-full items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3 text-left transition-colors hover:bg-primary/10"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium leading-tight">Build one for me</span>
                  <span className="block text-xs text-muted-foreground">
                    Answer a few quick questions and we&apos;ll plan a routine.
                  </span>
                </span>
              </button>

              <div className="flex items-center gap-3 py-1 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or pick a ready-made one
                <span className="h-px flex-1 bg-border" />
              </div>

              {STARTER_TEMPLATES.map((t) => {
                const isSel = selected === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setSelected(isSel ? null : t.key)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                      isSel ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    )}
                  >
                    <span className="text-2xl" aria-hidden>
                      {t.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium leading-tight">{t.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {t.exercises.length} exercises
                      </span>
                    </span>
                    {isSel && <Check className="size-5 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => finish()}>
                Skip
              </Button>
              <Button
                className="flex-1"
                onClick={() =>
                  finish(STARTER_TEMPLATES.find((t) => t.key === selected) ?? undefined)
                }
              >
                {selected ? "Add & finish" : "Finish"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
