"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Dumbbell, Pencil, Play, Plus, Trash2, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { CustomExerciseDialog } from "@/components/exercises/CustomExerciseDialog";
import { ExerciseLibraryBrowser } from "@/components/exercises/ExerciseLibraryBrowser";
import { ExerciseInfoDialog } from "@/components/exercises/ExerciseInfoDialog";
import {
  getCustomExercises,
  deleteCustomExercise,
  type CustomExercise,
} from "@/lib/storage/custom-exercises";
import { SET_UNITS } from "@/lib/workout";
import { ROUTES } from "@/lib/routes";

const unitLabel = (u: CustomExercise["defaultUnit"]) =>
  SET_UNITS.find((s) => s.value === u)?.label ?? u;

/** Browse the full exercise library and manage user-created exercises. */
export function ExercisesManager() {
  const [exercises, setExercises] = React.useState<CustomExercise[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CustomExercise | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<CustomExercise | null>(null);
  const [infoName, setInfoName] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => setExercises(getCustomExercises()), []);

  React.useEffect(() => {
    refresh();
    setLoaded(true);
  }, [refresh]);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (ex: CustomExercise) => {
    setEditing(ex);
    setDialogOpen(true);
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
        title="Exercises"
        description="Browse the full exercise library or manage your own custom exercises. Saved on this device."
      />

      <Tabs defaultValue="library" className="mt-2">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="library">Browse library</TabsTrigger>
          <TabsTrigger value="mine">My exercises</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="mt-4">
          <ExerciseLibraryBrowser enableMuscleMap onInfo={(name) => setInfoName(name)} />
        </TabsContent>

        <TabsContent value="mine" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button className="gap-2" onClick={openCreate}>
              <Plus className="size-4" />
              New exercise
            </Button>
          </div>

          {loaded && exercises.length === 0 ? (
            <EmptyState
              icon={<Dumbbell className="size-8" />}
              title="No custom exercises yet"
              description="Add exercises that aren't in the library (like swimming) and track them your way."
              action={
                <Button className="gap-2" onClick={openCreate}>
                  <Plus className="size-4" />
                  Create your first exercise
                </Button>
              }
            />
          ) : (
            <ul className="space-y-2">
              {exercises.map((ex) => (
                <li key={ex.name}>
                  <Card>
                    <CardContent className="flex items-start justify-between gap-3 p-3">
                      <div className="min-w-0 space-y-1.5">
                        <p className="break-words font-medium">{ex.name}</p>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="secondary">{unitLabel(ex.defaultUnit)}</Badge>
                          {ex.category && (
                            <Badge variant="secondary" className="capitalize">
                              {ex.category}
                            </Badge>
                          )}
                          {ex.primaryMuscles.map((m) => (
                            <Badge key={m} variant="outline" className="capitalize">
                              {m}
                            </Badge>
                          ))}
                          {ex.videoUrl && (
                            <Badge variant="outline" className="gap-1">
                              <Video className="size-3" />
                              Video
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={`Edit ${ex.name}`}
                          onClick={() => openEdit(ex)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Delete ${ex.name}`}
                          onClick={() => setPendingDelete(ex)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          {exercises.length > 0 && (
            <Button asChild variant="outline" className="w-full gap-2">
              <Link href={ROUTES.newWorkout}>
                <Play className="size-4" />
                Use them in a workout
              </Link>
            </Button>
          )}
        </TabsContent>
      </Tabs>

      <ExerciseInfoDialog
        exerciseName={infoName ?? ""}
        open={infoName !== null}
        onOpenChange={(open) => !open && setInfoName(null)}
      />

      <CustomExerciseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onCreated={() => refresh()}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this exercise?"
        description="This removes the custom exercise. Workouts and history that already use it keep their recorded data."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (pendingDelete) {
            deleteCustomExercise(pendingDelete.name);
            setPendingDelete(null);
            refresh();
          }
        }}
      />
    </PageContainer>
  );
}
