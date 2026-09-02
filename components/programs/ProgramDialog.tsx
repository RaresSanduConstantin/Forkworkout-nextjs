"use client";

import * as React from "react";
import type { Workout, WorkoutProgram } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SortableItemList } from "@/components/exercises/ReorderExercisesDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ProgramDialog({
  open,
  onOpenChange,
  workouts,
  program,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workouts: Workout[];
  program: WorkoutProgram | null;
  onSave: (value: { title: string; workoutIds: string[] }) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [workoutIds, setWorkoutIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!open) return;
    setTitle(program?.title ?? "");
    setWorkoutIds(program?.workoutIds.filter((id) => workouts.some((w) => w.id === id)) ?? []);
  }, [open, program, workouts]);

  const toggleWorkout = (id: string) => {
    setWorkoutIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };
  const move = (from: number, to: number) => {
    setWorkoutIds((current) => {
      if (from === to || from < 0 || to < 0 || from >= current.length || to >= current.length) {
        return current;
      }
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] max-w-md flex-col">
        <DialogHeader className="text-left">
          <DialogTitle>{program ? "Edit program" : "Create a program"}</DialogTitle>
          <DialogDescription>
            Choose workouts in rotation order. You can rearrange them below.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-4 overflow-y-auto">
          <div className="space-y-1.5">
            <label htmlFor="program-title" className="text-sm font-medium">Program name</label>
            <Input
              id="program-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Push / Pull / Legs"
              maxLength={60}
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Workouts</legend>
            {workouts.map((workout) => (
              <label
                key={workout.id}
                className="flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={workoutIds.includes(workout.id)}
                  onChange={() => toggleWorkout(workout.id)}
                  className="size-4 accent-primary"
                />
                <span className="min-w-0 truncate text-sm font-medium">{workout.title}</span>
              </label>
            ))}
          </fieldset>
          {workoutIds.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Rotation order</p>
              <SortableItemList
                items={workoutIds.map((id) => ({
                  id,
                  title: workouts.find((workout) => workout.id === id)?.title || "Untitled workout",
                }))}
                onMove={move}
              />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!title.trim() || workoutIds.length === 0}
            onClick={() => onSave({ title: title.trim(), workoutIds })}
          >
            {program ? "Save changes" : "Create program"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
