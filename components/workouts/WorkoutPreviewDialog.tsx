"use client";

import * as React from "react";
import { Dumbbell, Flame, Info, Layers, Play, Timer } from "lucide-react";

import { ExerciseInfoDialog } from "@/components/exercises/ExerciseInfoDialog";
import { MuscleMapView } from "@/components/history/MuscleMapView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Workout } from "@/lib/types";
import {
  getCachedLibrary,
  loadExerciseLibrary,
  type LibraryExercise,
} from "@/lib/exercises";
import { muscleHighlights, muscleScores } from "@/lib/muscle-map";
import { useMannequinGender } from "@/lib/use-body-gender";
import {
  effectiveRestSeconds,
  formatSetValue,
  getSetStages,
  inferUnit,
  restDurationLabel,
  setTypeShort,
} from "@/lib/workout";

export function WorkoutPreviewDialog({
  open,
  workout,
  onOpenChange,
  onStart,
}: {
  open: boolean;
  workout: Workout | null;
  onOpenChange: (open: boolean) => void;
  onStart: (id: string) => void;
}) {
  const [infoExercise, setInfoExercise] = React.useState<string | null>(null);
  const [library, setLibrary] = React.useState<LibraryExercise[]>(getCachedLibrary());
  const previewScrollAreaRef = React.useRef<HTMLDivElement>(null);
  const previewScrollTopRef = React.useRef(0);
  const shouldRestorePreviewScrollRef = React.useRef(false);
  const gender = useMannequinGender();

  React.useEffect(() => {
    if (!workout) return;
    let active = true;
    loadExerciseLibrary().then((loadedLibrary) => {
      if (active) setLibrary(loadedLibrary);
    });
    return () => {
      active = false;
    };
  }, [workout]);

  const setPreviewScrollAreaRef = React.useCallback((scrollArea: HTMLDivElement | null) => {
    previewScrollAreaRef.current = scrollArea;
    if (!scrollArea || !shouldRestorePreviewScrollRef.current) return;

    scrollArea.scrollTop = previewScrollTopRef.current;
    shouldRestorePreviewScrollRef.current = false;
  }, []);

  const setCount =
    workout?.exercises.reduce((total, exercise) => total + exercise.sets.length, 0) ?? 0;
  const plannedMuscleHighlights = React.useMemo(() => {
    if (!workout) return [];
    const plannedExercises = workout.exercises.map((exercise) => ({
      name: exercise.name,
      sets: exercise.sets.map((set) => ({
        status: "done" as const,
        type: set.type,
      })),
    }));
    return muscleHighlights(muscleScores(plannedExercises, library));
  }, [workout, library]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setInfoExercise(null);
      previewScrollTopRef.current = 0;
      shouldRestorePreviewScrollRef.current = false;
    }
    onOpenChange(open);
  };

  const handleInfoOpen = (exerciseName: string) => {
    previewScrollTopRef.current = previewScrollAreaRef.current?.scrollTop ?? 0;
    shouldRestorePreviewScrollRef.current = true;
    setInfoExercise(exerciseName);
  };

  const handleStart = () => {
    if (!workout) return;
    handleOpenChange(false);
    onStart(workout.id);
  };

  return (
    <>
      <Dialog
        open={open && workout !== null && infoExercise === null}
        onOpenChange={handleOpenChange}
      >
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] max-w-lg flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="space-y-2 border-b p-5 pr-12 text-left sm:p-6 sm:pr-12">
            <DialogTitle className="break-words text-xl">
              {workout?.title || "Untitled workout"}
            </DialogTitle>
            <DialogDescription>
              Review the exercises and planned sets before you start.
            </DialogDescription>
            {workout && (
              <div className="flex flex-wrap gap-2 pt-1" aria-label="Workout summary">
                <Badge variant="secondary" className="gap-1">
                  <Dumbbell className="size-3" />
                  {workout.exercises.length}{" "}
                  {workout.exercises.length === 1 ? "exercise" : "exercises"}
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Layers className="size-3" />
                  {setCount} {setCount === 1 ? "set" : "sets"}
                </Badge>
              </div>
            )}
          </DialogHeader>

          <div
            ref={setPreviewScrollAreaRef}
            className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"
          >
            {workout?.exercises.length ? (
              <div className="space-y-4">
                <Accordion
                  type="single"
                  collapsible
                  defaultValue="muscles"
                  className="rounded-xl border px-4"
                >
                  <AccordionItem value="muscles" className="border-b-0">
                    <AccordionTrigger className="hover:no-underline">
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <Flame className="size-4 text-orange-500" />
                        Muscles worked
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <MuscleMapView
                        highlights={plannedMuscleHighlights}
                        gender={gender}
                      />
                      <p className="mt-2 text-center text-xs text-muted-foreground">
                        Based on planned working sets. Primary muscles appear darker;
                        secondary muscles appear lighter.
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <ol className="space-y-3">
                  {workout.exercises.map((exercise, exerciseIndex) => {
                    const restSeconds = effectiveRestSeconds(exercise.rest, workout.rest);

                    return (
                      <li
                        key={exercise.id ?? `${exercise.name}-${exerciseIndex}`}
                        className="rounded-xl border bg-card p-3.5"
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                            aria-hidden
                          >
                            {exerciseIndex + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <h3 className="break-words font-semibold leading-7">
                              {exercise.name || "Unnamed exercise"}
                            </h3>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {restSeconds > 0 && (
                                <Badge variant="outline" className="gap-1 font-normal">
                                  <Timer className="size-3" />
                                  {restDurationLabel(restSeconds)} rest
                                </Badge>
                              )}
                              {exercise.superset && (
                                <Badge variant="outline" className="font-normal">
                                  Superset {exercise.superset}
                                </Badge>
                              )}
                              {exercise.unilateral && (
                                <Badge variant="outline" className="font-normal">
                                  Each side
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0 gap-1.5"
                            onClick={() => handleInfoOpen(exercise.name)}
                            aria-label={`View information for ${exercise.name || "exercise"}`}
                          >
                            <Info className="size-4" />
                            Info
                          </Button>
                        </div>

                        {exercise.sets.length ? (
                          <ol className="mt-3 divide-y rounded-lg bg-muted/50 px-3">
                            {exercise.sets.map((set, setIndex) => {
                              const type = setTypeShort(set.type);
                              return (
                                <li
                                  key={set.id ?? setIndex}
                                  className="flex min-h-10 items-center justify-between gap-3 py-2 text-sm"
                                >
                                  <span className="text-muted-foreground">
                                    Set {setIndex + 1}
                                  </span>
                                  <span className="text-right font-medium">
                                    {getSetStages(set)
                                      .map((stage) => {
                                        const unit = inferUnit(stage.value, stage.unit);
                                        return unit === "bw"
                                          ? `${stage.reps} ${stage.reps === 1 ? "rep" : "reps"}`
                                          : `${stage.reps} × ${formatSetValue(stage.value, unit)}`;
                                      })
                                      .join(" → ")}
                                    {type && (
                                      <span className="font-normal text-muted-foreground">
                                        {` · ${type}`}
                                      </span>
                                    )}
                                  </span>
                                </li>
                              );
                            })}
                          </ol>
                        ) : (
                          <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                            No sets planned.
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Dumbbell className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  This workout does not have any exercises yet.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="border-t p-4 sm:p-5">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
            <Button onClick={handleStart} disabled={!workout?.exercises.length}>
              <Play className="size-4" />
              Start workout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExerciseInfoDialog
        exerciseName={infoExercise ?? ""}
        open={infoExercise !== null}
        onOpenChange={(open) => {
          if (!open) setInfoExercise(null);
        }}
        allowVideoEdit
        onVideoSaved={() => setLibrary(getCachedLibrary())}
      />
    </>
  );
}
