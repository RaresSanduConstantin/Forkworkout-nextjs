"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MuscleMapPicker } from "@/components/workouts/MuscleMapPicker";
import { ExerciseLibraryBrowser } from "@/components/exercises/ExerciseLibraryBrowser";
import { useMannequinGender } from "@/lib/use-body-gender";
import { TARGET_BY_KEY, type MuscleGroup, type MuscleTargetKey } from "@/lib/exercises";

/**
 * Pick an exercise by tapping the muscle you want to train on the body map, then
 * choosing from the exercises for that muscle group. Used from the live session
 * "Add Exercise" flow for when you know the muscle but not the exercise name.
 */
export function AddExerciseByMuscleDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (name: string) => void;
}) {
  const gender = useMannequinGender();
  const [selected, setSelected] = React.useState<MuscleTargetKey | null>(null);

  React.useEffect(() => {
    if (!open) setSelected(null);
  }, [open]);

  const group: MuscleGroup | null = selected
    ? (TARGET_BY_KEY.get(selected)?.group ?? null)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-md flex-col overflow-hidden">
        <DialogHeader className="text-left">
          <DialogTitle>Add by muscle</DialogTitle>
          <DialogDescription>
            Tap the muscle you want to train, then pick an exercise.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-6 flex-1 space-y-4 overflow-y-auto px-6">
          <MuscleMapPicker
            value={selected ? [selected] : []}
            onToggle={(key) => setSelected((cur) => (cur === key ? null : key))}
            gender={gender}
          />

          {group ? (
            <ExerciseLibraryBrowser
              key={group}
              initialGroup={group}
              hideGroupFilter
              onPick={(name) => {
                onPick(name);
                onOpenChange(false);
              }}
            />
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Tap a muscle on the body to see exercises for it.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
