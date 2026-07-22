"use client";

import * as React from "react";
import { Dumbbell, Info, RefreshCw, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getCachedLibrary,
  getExerciseStableId,
  loadExerciseLibrary,
  type LibraryExercise,
} from "@/lib/exercises";
import { getExercisePreferences } from "@/lib/storage/exercise-preferences";
import {
  availableCustomReplacements,
  recommendExerciseReplacements,
} from "@/lib/smart-workout/exercise-replacements";
import { ExerciseInfoDialog } from "@/components/exercises/ExerciseInfoDialog";

export function ReplaceExerciseDialog({
  open,
  onOpenChange,
  exerciseName,
  excludedNames = [],
  onReplace,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exerciseName: string;
  excludedNames?: string[];
  onReplace: (exercise: LibraryExercise) => void;
}) {
  const [library, setLibrary] = React.useState<LibraryExercise[]>(getCachedLibrary());
  const [loading, setLoading] = React.useState(library.length === 0);
  const [infoExerciseName, setInfoExerciseName] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(library.length === 0);
    loadExerciseLibrary().then((next) => {
      if (!active) return;
      setLibrary(next);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [open, library.length]);

  const preferences = React.useMemo(
    () => (open ? getExercisePreferences() : []),
    [open]
  );
  const suggestions = React.useMemo(
    () =>
      recommendExerciseReplacements({
        library,
        currentName: exerciseName,
        preferences,
        excludedNames,
      }),
    [library, exerciseName, preferences, excludedNames]
  );
  const suggestedIds = React.useMemo(
    () => new Set(suggestions.map(({ exercise }) => getExerciseStableId(exercise))),
    [suggestions]
  );
  const customOptions = React.useMemo(
    () =>
      availableCustomReplacements({
        library,
        currentName: exerciseName,
        preferences,
        excludedNames,
      }).filter((exercise) => !suggestedIds.has(getExerciseStableId(exercise))),
    [library, exerciseName, preferences, excludedNames, suggestedIds]
  );

  const choose = (exercise: LibraryExercise) => {
    onReplace(exercise);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] max-w-lg flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-6 pt-6 text-left">
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="size-5 text-primary" />
            Replace exercise
          </DialogTitle>
          <DialogDescription>
            Alternatives for <span className="font-medium text-foreground">{exerciseName}</span>,
            ranked by matching muscles and your exercise preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Finding alternatives…
            </p>
          ) : suggestions.length === 0 && customOptions.length === 0 ? (
            <div className="py-10 text-center">
              <Dumbbell className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 font-medium">No matching alternatives found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try changing the exercise from the search field instead.
              </p>
            </div>
          ) : (
            <div className="space-y-5 pt-4">
              {suggestions.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Recommended for the same muscles
                  </h3>
                  <ul className="space-y-2">
                    {suggestions.map(({ exercise, reasons }, index) => (
                <li key={exercise.id ?? exercise.name}>
                  <div className="rounded-xl border bg-card p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="font-medium leading-tight">{exercise.name}</p>
                          {index === 0 && (
                            <Badge variant="secondary" className="gap-1">
                              <Sparkles className="size-3" /> Best match
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs capitalize text-muted-foreground">
                          {exercise.primaryMuscles.join(", ")}
                          {exercise.equipment ? ` · ${exercise.equipment}` : ""}
                        </p>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {reasons.slice(0, 2).join(" ")}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`How to do ${exercise.name}`}
                          onClick={() => setInfoExerciseName(exercise.name)}
                        >
                          <Info className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => choose(exercise)}
                        >
                          <RefreshCw className="size-3.5" />
                          Replace
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
                    ))}
                  </ul>
                </section>
              )}

              {customOptions.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Your custom exercises
                  </h3>
                  <ul className="space-y-2">
                    {customOptions.map((exercise) => (
                      <li key={exercise.id ?? exercise.name}>
                        <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{exercise.name}</p>
                            <p className="mt-1 text-xs capitalize text-muted-foreground">
                              {exercise.primaryMuscles.join(", ")}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`How to do ${exercise.name}`}
                              onClick={() => setInfoExerciseName(exercise.name)}
                            >
                              <Info className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => choose(exercise)}
                            >
                              <RefreshCw className="size-3.5" />
                              Replace
                            </Button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>

        <ExerciseInfoDialog
          exerciseName={infoExerciseName ?? ""}
          open={infoExerciseName !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setInfoExerciseName(null);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
