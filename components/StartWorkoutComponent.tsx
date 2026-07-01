"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { v4 as uuidv4 } from "uuid";
import { ArrowLeft, Check, Dumbbell, ExternalLink, Info, ListChecks, Plus, SkipForward, Target } from "lucide-react";

import { Button } from "./ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { ExerciseCombobox } from "./ExerciseCombobox";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { PageContainer } from "@/components/layout/PageContainer";
import { BottomActionBar } from "@/components/layout/BottomActionBar";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { honkFont } from "@/lib/honkFont";

import { getWorkoutById, getWorkouts, saveWorkouts } from "@/lib/storage/workout-storage";
import { addCompletedWorkout } from "@/lib/storage/history-storage";
import {
  getActiveSessionFor,
  saveActiveSession,
  clearActiveSession,
} from "@/lib/storage/session-storage";
import { playSound, SOUNDS } from "@/lib/sound";
import { inferUnit, setVolumeKg, unitPlaceholder } from "@/lib/workout";
import { ROUTES } from "@/lib/routes";
import type { ActiveSession, SessionSet, SetStatus } from "@/lib/types";
import { toast } from "sonner";

// Type for exercise details from JSON
type ExerciseDetails = {
  name: string;
  force: string;
  level: string;
  mechanic: string | null;
  equipment: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
};

const StartWorkoutComponent = () => {
  const params = useParams();
  const workoutId = params.id as string;
  const router = useRouter();

  const [workout, setWorkout] = useState<ActiveSession | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [resting, setResting] = useState(false);
  const [restSeconds, setRestSeconds] = useState(0);
  const [countdown, setCountdown] = useState(0);

  const [showVideoModal, setShowVideoModal] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<string>("");
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [exerciseDetails, setExerciseDetails] = useState<ExerciseDetails | null>(null);
  const [exercises, setExercises] = useState<ExerciseDetails[]>([]);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Load exercise reference data.
  useEffect(() => {
    const loadExercises = async () => {
      try {
        const response = await fetch("/json/exercises.json");
        const data = await response.json();
        setExercises(data.exercises || []);
      } catch (error) {
        console.error("Failed to load exercises:", error);
      }
    };
    loadExercises();
  }, []);

  // Load the workout — resuming an in-progress session if one exists.
  useEffect(() => {
    const found = getWorkoutById(workoutId);
    setRestSeconds(found?.rest ? parseInt(found.rest, 10) || 0 : 0);

    const saved = getActiveSessionFor(workoutId);
    if (saved) {
      setWorkout(saved);
    } else if (found) {
      setWorkout({
        workoutId: found.id,
        title: found.title,
        startedAt: new Date().toISOString(),
        exercises: found.exercises.map((ex) => ({
          id: ex.id ?? uuidv4(),
          name: ex.name,
          sets: ex.sets.map((s) => ({
            id: s.id ?? uuidv4(),
            reps: s.reps,
            value: s.value,
            unit: s.unit ?? inferUnit(s.value),
            status: "pending" as SetStatus,
          })),
        })),
      });
    }
    setLoaded(true);
  }, [workoutId]);

  // Persist session progress so a refresh can resume it.
  useEffect(() => {
    if (loaded && workout) saveActiveSession(workout);
  }, [workout, loaded]);

  // Rest countdown timer with cleanup and end sound.
  useEffect(() => {
    if (!resting) return;
    if (countdown <= 0) {
      setResting(false);
      playSound(SOUNDS.restEnd);
      return;
    }
    const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, resting]);

  const progress = useMemo(() => {
    if (!workout) return { done: 0, skipped: 0, handled: 0, total: 0, percent: 0 };
    let done = 0;
    let skipped = 0;
    let total = 0;
    for (const ex of workout.exercises) {
      for (const s of ex.sets) {
        total += 1;
        if (s.status === "done") done += 1;
        else if (s.status === "skipped") skipped += 1;
      }
    }
    const handled = done + skipped;
    return { done, skipped, handled, total, percent: total ? (handled / total) * 100 : 0 };
  }, [workout]);

  const openVideoModal = (exerciseName: string) => {
    setSelectedExercise(exerciseName);
    setShowVideoModal(true);
  };

  const openInfoModal = (exerciseName: string) => {
    const exercise = exercises.find(
      (ex) => ex.name.toLowerCase() === exerciseName.toLowerCase()
    );
    setExerciseDetails(exercise || null);
    setSelectedExercise(exerciseName);
    setShowInfoModal(true);
  };

  const formatExerciseNameForUrl = (name: string) =>
    name.replace(/[\/\s]+/g, "_").replace(/^_+|_+$/g, "");

  const getExerciseImageUrls = (exerciseName: string) => {
    const formattedName = formatExerciseNameForUrl(exerciseName);
    return [
      `https://raw.githubusercontent.com/wrkout/exercises.json/master/exercises/${formattedName}/images/0.jpg`,
      `https://raw.githubusercontent.com/wrkout/exercises.json/master/exercises/${formattedName}/images/1.jpg`,
    ];
  };

  // --- Immutable session mutators ---
  const updateSet = (
    exIdx: number,
    setIdx: number,
    updater: (set: SessionSet) => SessionSet
  ) => {
    setWorkout((prev) =>
      prev
        ? {
            ...prev,
            exercises: prev.exercises.map((ex, i) =>
              i !== exIdx
                ? ex
                : { ...ex, sets: ex.sets.map((s, j) => (j === setIdx ? updater(s) : s)) }
            ),
          }
        : prev
    );
  };

  const markSet = (exIdx: number, setIdx: number, status: SetStatus) =>
    updateSet(exIdx, setIdx, (s) => ({ ...s, status }));

  const updateSetReps = (exIdx: number, setIdx: number, reps: number) =>
    updateSet(exIdx, setIdx, (s) => ({ ...s, reps }));

  const updateSetValue = (exIdx: number, setIdx: number, value: string) =>
    updateSet(exIdx, setIdx, (s) => ({ ...s, value }));

  const addExercise = () => {
    setWorkout((prev) =>
      prev
        ? {
            ...prev,
            exercises: [
              ...prev.exercises,
              {
                id: uuidv4(),
                name: "",
                sets: [{ id: uuidv4(), reps: 1, value: "", unit: "kg", status: "pending" }],
              },
            ],
          }
        : prev
    );
  };

  const addSet = (exIdx: number) => {
    setWorkout((prev) =>
      prev
        ? {
            ...prev,
            exercises: prev.exercises.map((ex, i) =>
              i !== exIdx
                ? ex
                : {
                    ...ex,
                    sets: [...ex.sets, { id: uuidv4(), reps: 1, value: "", unit: "kg", status: "pending" }],
                  }
            ),
          }
        : prev
    );
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    setWorkout((prev) =>
      prev
        ? {
            ...prev,
            exercises: prev.exercises.map((ex, i) =>
              i !== exIdx ? ex : { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) }
            ),
          }
        : prev
    );
  };

  const updateExerciseName = (exIdx: number, name: string) => {
    setWorkout((prev) =>
      prev
        ? {
            ...prev,
            exercises: prev.exercises.map((ex, i) => (i !== exIdx ? ex : { ...ex, name })),
          }
        : prev
    );
  };

  const handleComplete = (exIdx: number, setIdx: number) => {
    markSet(exIdx, setIdx, "done");
    if (!restSeconds) return;
    setCountdown(restSeconds);
    setResting(true);
    playSound(SOUNDS.restStart);
  };

  const handleSkip = (exIdx: number, setIdx: number) => {
    markSet(exIdx, setIdx, "skipped");
  };

  const handleFinish = () => {
    if (!workout) {
      router.push(ROUTES.dashboard);
      return;
    }

    // Total kg lifted this session = sum of reps × weight over completed kg sets.
    const volume = workout.exercises.reduce(
      (sum, ex) =>
        sum +
        ex.sets.reduce(
          (s, set) => s + (set.status === "done" ? setVolumeKg(set.reps, set.value, set.unit) : 0),
          0
        ),
      0
    );

    addCompletedWorkout({ workoutId: workout.workoutId, title: workout.title, volume });

    // Persist edited reps/values/units back onto the saved workout (strip statuses).
    const workouts = getWorkouts();
    const idx = workouts.findIndex((w) => w.id === workoutId);
    if (idx !== -1) {
      workouts[idx] = {
        ...workouts[idx],
        exercises: workout.exercises.map((ex) => ({
          id: ex.id,
          name: ex.name,
          sets: ex.sets.map((set) => ({ id: set.id, reps: set.reps, value: set.value, unit: set.unit })),
        })),
        updatedAt: new Date().toISOString(),
      };
      saveWorkouts(workouts);
    }

    clearActiveSession();
    toast.success("Workout complete! 🎉");
    router.push(ROUTES.dashboard);
  };

  const requestExit = () => {
    if (progress.handled > 0) {
      setShowExitConfirm(true);
    } else {
      clearActiveSession();
      router.push(ROUTES.dashboard);
    }
  };

  if (loaded && !workout) {
    return (
      <div className="mt-20 flex h-full flex-col items-center justify-center gap-5 p-6 text-center">
        <h1 className="text-2xl font-semibold">{honkFont("No Workout Found")}</h1>
        <p className="mt-4 text-muted-foreground">
          Please go back and select a workout to start.
        </p>
        <Button onClick={() => router.push(ROUTES.dashboard)} className="mt-6">
          Go Back Home
        </Button>
      </div>
    );
  }

  if (!workout) return null;

  return (
    <PageContainer hasBottomBar>
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" className="gap-1 px-2" onClick={requestExit}>
          <ArrowLeft className="size-4" />
          Go Back
        </Button>
      </div>

      <h1 className="break-words text-center text-4xl font-bold">
        {honkFont(workout.title)}
      </h1>

      {/* Progress (sticky so it stays visible while scrolling exercises) */}
      <div className="sticky top-0 z-30 -mx-4 mt-4 border-b border-border/60 bg-slate-50/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-slate-50/75">
        <div className="mb-1.5 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {progress.handled} / {progress.total} sets
          </span>
          <span>
            {progress.done} done · {progress.skipped} skipped
          </span>
        </div>
        <Progress value={progress.percent} aria-label="Workout progress" />
      </div>

      <div className="mt-6 space-y-4">
        {workout.exercises.map((exercise, exIdx) => (
          <Card key={exercise.id ?? exIdx}>
            <CardContent className="space-y-3 p-4">
              <ExerciseCombobox
                value={exercise.name}
                onChange={(value) => updateExerciseName(exIdx, value)}
                placeholder="Search for an exercise..."
              />
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => openInfoModal(exercise.name)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Info about ${exercise.name || "exercise"}`}
                >
                  <Info className="h-5 w-5" />
                </button>
                <button
                  onClick={() => openVideoModal(exercise.name)}
                  className="text-red-600 hover:text-red-800"
                  aria-label={`Watch videos for ${exercise.name || "exercise"}`}
                >
                  <Image src="/youtube.png" alt="" width={24} height={24} />
                </button>
              </div>

              {exercise.sets.map((set, setIdx) => {
                const statusStyles =
                  set.status === "done"
                    ? "border-lime-500/60 bg-lime-50"
                    : set.status === "skipped"
                    ? "border-border bg-muted opacity-70"
                    : "border-border bg-card";

                const unit = set.unit ?? inferUnit(set.value);

                return (
                  <div
                    key={set.id ?? setIdx}
                    className={`space-y-2 rounded-lg border p-3 ${statusStyles}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-center text-xs font-medium text-muted-foreground">
                        {setIdx + 1}
                      </span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={set.reps}
                        onChange={(e) =>
                          updateSetReps(exIdx, setIdx, parseInt(e.target.value) || 0)
                        }
                        className="h-9 w-16 text-center"
                        aria-label={`Reps for set ${setIdx + 1}`}
                      />
                      <span className="text-sm text-muted-foreground">reps</span>
                      {unit === "bw" ? (
                        <div className="flex flex-1 justify-start">
                          <Badge variant="secondary">Bodyweight</Badge>
                        </div>
                      ) : (
                        <div className="flex flex-1 items-center gap-1.5">
                          <Input
                            type={unit === "kg" ? "number" : "text"}
                            inputMode={unit === "kg" ? "decimal" : "text"}
                            min={unit === "kg" ? 0 : undefined}
                            value={set.value}
                            onChange={(e) => updateSetValue(exIdx, setIdx, e.target.value)}
                            className="h-9 flex-1"
                            placeholder={unitPlaceholder(unit)}
                            aria-label={unit === "kg" ? "Weight in kg" : "Duration"}
                          />
                          {unit === "kg" && (
                            <span className="text-sm text-muted-foreground">kg</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={set.status === "done" ? "default" : "outline"}
                        size="sm"
                        className="flex-1 gap-1"
                        onClick={() => handleComplete(exIdx, setIdx)}
                      >
                        <Check className="size-4" />
                        Done
                      </Button>
                      <Button
                        variant={set.status === "skipped" ? "secondary" : "ghost"}
                        size="sm"
                        className="flex-1 gap-1"
                        onClick={() => handleSkip(exIdx, setIdx)}
                      >
                        <SkipForward className="size-4" />
                        Skip
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeSet(exIdx, setIdx)}
                        disabled={exercise.sets.length === 1}
                        aria-label={`Remove set ${setIdx + 1}`}
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                );
              })}

              <Button
                variant="outline"
                onClick={() => addSet(exIdx)}
                className="w-full gap-1 border-dashed"
              >
                <Plus className="size-4" />
                Add Set
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={addExercise}
        className="mt-4 w-full gap-2 border-dashed"
      >
        <Plus className="size-4" />
        Add Exercise
      </Button>

      {/* Exercise Info Modal */}
      <Dialog open={showInfoModal} onOpenChange={setShowInfoModal}>
        <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="space-y-1 border-b p-6 pb-4 text-left">
            <DialogTitle className="text-xl">{selectedExercise || "Exercise"}</DialogTitle>
            <DialogDescription>How to perform it, muscles worked, and tips.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-5 overflow-y-auto p-6">
            {exerciseDetails ? (
              <>
                <Carousel className="w-full">
                  <CarouselContent>
                    {getExerciseImageUrls(selectedExercise).map((imageUrl, index) => (
                      <CarouselItem key={index}>
                        <AspectRatio ratio={4 / 3} className="overflow-hidden rounded-lg bg-muted">
                          <Image
                            src={imageUrl}
                            alt={`${selectedExercise} demonstration ${index + 1}`}
                            fill
                            className="object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.visibility = "hidden";
                            }}
                          />
                        </AspectRatio>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious className="left-2" />
                  <CarouselNext className="right-2" />
                </Carousel>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="capitalize">{exerciseDetails.level}</Badge>
                  <Badge variant="secondary" className="capitalize">{exerciseDetails.category}</Badge>
                  <Badge variant="secondary" className="gap-1 capitalize">
                    <Dumbbell className="size-3" />
                    {exerciseDetails.equipment || "No equipment"}
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div>
                    <h4 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
                      <Target className="size-4 text-primary" /> Primary muscles
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {exerciseDetails.primaryMuscles.map((m) => (
                        <Badge key={m} className="capitalize">{m}</Badge>
                      ))}
                    </div>
                  </div>

                  {exerciseDetails.secondaryMuscles.length > 0 && (
                    <div>
                      <h4 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
                        <Target className="size-4 text-muted-foreground" /> Secondary muscles
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {exerciseDetails.secondaryMuscles.map((m) => (
                          <Badge key={m} variant="outline" className="capitalize">{m}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                <div>
                  <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                    <ListChecks className="size-4 text-primary" /> Instructions
                  </h4>
                  <ol className="space-y-2 text-sm text-muted-foreground">
                    {exerciseDetails.instructions.map((instruction, index) => (
                      <li key={index} className="flex gap-2.5">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {index + 1}
                        </span>
                        <span>{instruction}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Dumbbell className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No detailed information available for this exercise.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="border-t p-4">
            <Button variant="outline" className="w-full" onClick={() => setShowInfoModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Modal */}
      <Dialog open={showVideoModal} onOpenChange={setShowVideoModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="text-left">
            <DialogTitle>Watch a demo</DialogTitle>
            <DialogDescription>
              Reels &amp; form tips for {selectedExercise || "this exercise"}. Opens in a new tab.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Button
              className="w-full justify-between bg-red-600 text-white hover:bg-red-700"
              onClick={() =>
                window.open(
                  `https://www.youtube.com/results?search_query=${encodeURIComponent(
                    selectedExercise + " exercise form #shorts"
                  )}`,
                  "_blank",
                  "noopener,noreferrer"
                )
              }
            >
              <span className="flex items-center gap-2">🎥 YouTube Shorts</span>
              <ExternalLink className="size-4" />
            </Button>
            <Button
              className="w-full justify-between bg-neutral-900 text-white hover:bg-neutral-800"
              onClick={() =>
                window.open(
                  `https://www.tiktok.com/search?q=${encodeURIComponent(
                    selectedExercise + " exercise form"
                  )}`,
                  "_blank",
                  "noopener,noreferrer"
                )
              }
            >
              <span className="flex items-center gap-2">🎵 TikTok</span>
              <ExternalLink className="size-4" />
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" className="w-full" onClick={() => setShowVideoModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rest Timer */}
      <Dialog
        open={resting}
        onOpenChange={(open) => {
          setResting(open);
          if (!open) setCountdown(0);
        }}
      >
        <DialogContent className="space-y-4 text-center">
          <DialogDescription className="sr-only">Rest timer countdown</DialogDescription>
          <DialogTitle className="text-2xl font-bold">{honkFont("Rest Time")}</DialogTitle>
          <div className="font-mono text-6xl font-bold text-primary tabular-nums">
            {countdown}s
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setResting(false);
              setCountdown(0);
            }}
          >
            Skip Rest
          </Button>
        </DialogContent>
      </Dialog>

      {/* Exit confirmation */}
      <ConfirmDialog
        open={showExitConfirm}
        onOpenChange={setShowExitConfirm}
        title="Leave this workout?"
        description="Your progress is saved on this device — you can resume it later from the workout."
        confirmLabel="Leave"
        cancelLabel="Keep going"
        onConfirm={() => {
          setShowExitConfirm(false);
          router.push(ROUTES.dashboard);
        }}
      />

      <BottomActionBar>
        <Button variant="outline" className="flex-1" onClick={requestExit}>
          Cancel
        </Button>
        <Button className="flex-1" onClick={handleFinish}>
          Finish Workout
        </Button>
      </BottomActionBar>
    </PageContainer>
  );
};

export default StartWorkoutComponent;
