"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { v4 as uuidv4 } from "uuid";
import { ArrowLeft, Check, ChevronsUpDown, Dumbbell, ExternalLink, Info, ListChecks, Plus, SkipForward, Target, Timer, X } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { addCompletedWorkout, getCompletedWorkouts } from "@/lib/storage/history-storage";
import {
  getActiveSessionFor,
  saveActiveSession,
  clearActiveSession,
} from "@/lib/storage/session-storage";
import { SOUNDS } from "@/lib/sound";
import { useWakeLock } from "@/hooks/useWakeLock";
import { inferUnit, setVolumeKg, unitPlaceholder, formatClock, formatEstimate, effectiveRestSeconds, estimateWorkoutSeconds, restDurationLabel, EXERCISE_REST_OPTIONS } from "@/lib/workout";
import { getExerciseVideoId } from "@/lib/exercise-videos";
import { ExerciseStatsLine } from "@/components/session/ExerciseStatsLine";
import { ROUTES } from "@/lib/routes";
import type { ActiveSession, CompletedWorkout, SessionSet, SetStatus, SetUnit } from "@/lib/types";
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

/** Trigger text for the per-exercise rest dropdown. When the exercise has no
 *  override, show the effective workout default so the user knows the value. */
function restTriggerLabel(rest: string | undefined, defaultSec: number): string {
  if (rest === undefined || rest === "") {
    return `Rest Timer: Default (${restDurationLabel(defaultSec)})`;
  }
  const sec = parseInt(rest, 10) || 0;
  return `Rest Timer: ${restDurationLabel(sec)}`;
}

const StartWorkoutComponent = () => {
  const params = useParams();
  const workoutId = params.id as string;
  const router = useRouter();

  const [workout, setWorkout] = useState<ActiveSession | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [history, setHistory] = useState<CompletedWorkout[]>([]);

  const [resting, setResting] = useState(false);
  const [restSeconds, setRestSeconds] = useState(0);
  const [countdown, setCountdown] = useState(0);

  const [showVideoModal, setShowVideoModal] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<string>("");
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [exerciseDetails, setExerciseDetails] = useState<ExerciseDetails | null>(null);
  const [exercises, setExercises] = useState<ExerciseDetails[]>([]);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [addSetFor, setAddSetFor] = useState<number | null>(null);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  // Keep the phone screen awake during the workout.
  useWakeLock(true);

  // Remembers each set's value per unit, so cycling units (Kg → Time → … → Kg)
  // restores the previously entered value instead of wiping it.
  const unitValueMemory = useRef<Record<string, Partial<Record<SetUnit, string>>>>({});

  // Persistent audio elements. The rest-END sound fires from a timer (no user
  // gesture), which mobile browsers block — so we "unlock" it during the tap
  // that starts the rest, then it can play when the countdown finishes.
  const restStartAudioRef = useRef<HTMLAudioElement | null>(null);
  const restEndAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    restStartAudioRef.current = new Audio(SOUNDS.restStart);
    restEndAudioRef.current = new Audio(SOUNDS.restEnd);
    restStartAudioRef.current.preload = "auto";
    restEndAudioRef.current.preload = "auto";
  }, []);

  const playAudio = (el: HTMLAudioElement | null) => {
    if (!el) return;
    try {
      el.currentTime = 0;
      void el.play().catch(() => {});
    } catch {
      /* ignore */
    }
  };

  // Play muted within a user gesture to unlock the element for later autoplay.
  const unlockAudio = (el: HTMLAudioElement | null) => {
    if (!el) return;
    try {
      el.muted = true;
      void el
        .play()
        .then(() => {
          el.pause();
          el.currentTime = 0;
          el.muted = false;
        })
        .catch(() => {
          el.muted = false;
        });
    } catch {
      el.muted = false;
    }
  };

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
    // Snapshot history once for the per-exercise "last time / PR" hints.
    setHistory(getCompletedWorkouts());

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
          rest: ex.rest,
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
      playAudio(restEndAudioRef.current);
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

  // Estimated total workout time (shared with the generator so they agree).
  const estimateSec = useMemo(() => {
    if (!workout) return 0;
    return estimateWorkoutSeconds(workout.exercises, restSeconds ? String(restSeconds) : "");
  }, [workout, restSeconds]);

  // Live elapsed time since the session started.
  const [elapsedSec, setElapsedSec] = useState(0);
  const startedAt = workout?.startedAt;
  useEffect(() => {
    if (!startedAt) return;
    const startedMs = new Date(startedAt).getTime();
    if (!Number.isFinite(startedMs)) return;
    const tick = () => setElapsedSec(Math.max(0, Math.round((Date.now() - startedMs) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const openVideoModal = (exerciseName: string) => {
    setSelectedExercise(exerciseName);
    setShowVideoModal(true);
  };

  // Curated in-modal demo video for the selected exercise (null → search fallback).
  const demoVideoId = getExerciseVideoId(selectedExercise);

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

  // Units are per-exercise in the session table: cycle & apply to every set.
  const UNIT_CYCLE: SetUnit[] = ["kg", "bw", "time", "km"];
  const unitLabel = (u: SetUnit) =>
    u === "kg" ? "Kg" : u === "bw" ? "BW" : u === "time" ? "Time" : "Km";

  const cycleExerciseUnit = (exIdx: number) => {
    setWorkout((prev) => {
      if (!prev) return prev;
      const cur = prev.exercises[exIdx]?.sets[0]?.unit ?? "kg";
      const next = UNIT_CYCLE[(UNIT_CYCLE.indexOf(cur) + 1) % UNIT_CYCLE.length];
      return {
        ...prev,
        exercises: prev.exercises.map((ex, i) => {
          if (i !== exIdx) return ex;
          return {
            ...ex,
            sets: ex.sets.map((s, j) => {
              const key = s.id ?? `${exIdx}:${j}`;
              // Stash the current value under the old unit before switching.
              const mem = (unitValueMemory.current[key] ??= {});
              mem[cur] = s.value;
              const value =
                next === "bw" ? "BW" : mem[next] !== undefined ? mem[next]! : "";
              return { ...s, unit: next, value };
            }),
          };
        }),
      };
    });
  };

  // Per-exercise rest override for the live session. undefined = use the
  // workout default; "0" = off; else seconds. Changed via a dropdown per card.
  const setExerciseRest = (exIdx: number, rest: string | undefined) => {
    setWorkout((prev) =>
      prev
        ? {
            ...prev,
            exercises: prev.exercises.map((ex, i) =>
              i === exIdx ? { ...ex, rest } : ex
            ),
          }
        : prev
    );
  };

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

  const addSet = (exIdx: number, copyPrevious: boolean) => {
    setWorkout((prev) =>
      prev
        ? {
            ...prev,
            exercises: prev.exercises.map((ex, i) => {
              if (i !== exIdx) return ex;
              const last = ex.sets[ex.sets.length - 1];
              const nextSet =
                copyPrevious && last
                  ? {
                      id: uuidv4(),
                      reps: last.reps,
                      value: last.value,
                      unit: last.unit ?? "kg",
                      status: "pending" as SetStatus,
                    }
                  : {
                      id: uuidv4(),
                      reps: 1,
                      value: "",
                      unit: "kg" as const,
                      status: "pending" as SetStatus,
                    };
              return { ...ex, sets: [...ex.sets, nextSet] };
            }),
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
    const set = workout?.exercises[exIdx]?.sets[setIdx];
    // Tap cycles Done -> Skipped -> Done. Marking Done starts the rest timer.
    if (set?.status === "done") {
      markSet(exIdx, setIdx, "skipped");
      return;
    }
    // Require a value before completing (bodyweight sets are exempt).
    const unit = set?.unit ?? inferUnit(set?.value ?? "");
    if (unit !== "bw" && !(set?.value ?? "").trim()) {
      toast.error("Enter a value first before marking this set done.");
      return;
    }
    markSet(exIdx, setIdx, "done");
    const eff = effectiveRestSeconds(
      workout?.exercises[exIdx]?.rest,
      restSeconds ? String(restSeconds) : ""
    );
    if (!eff) return;
    setCountdown(eff);
    setResting(true);
    // This runs from a user tap, so play the start sound and unlock the end
    // sound so it can autoplay when the rest timer finishes.
    playAudio(restStartAudioRef.current);
    unlockAudio(restEndAudioRef.current);
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

    // Total reps over completed sets.
    const totalReps = workout.exercises.reduce(
      (sum, ex) =>
        sum + ex.sets.reduce((s, set) => s + (set.status === "done" ? set.reps : 0), 0),
      0
    );

    // Elapsed session time.
    const startedMs = new Date(workout.startedAt).getTime();
    const durationSec = Number.isFinite(startedMs)
      ? Math.max(0, Math.round((Date.now() - startedMs) / 1000))
      : undefined;

    // Snapshot of what was performed (for the history detail view).
    const snapshot = workout.exercises.map((ex) => ({
      name: ex.name,
      sets: ex.sets.map((set) => ({
        reps: set.reps,
        value: set.value,
        unit: set.unit,
        status: set.status,
      })),
    }));

    addCompletedWorkout({
      workoutId: workout.workoutId,
      title: workout.title,
      volume,
      totalReps,
      durationSec,
      exercises: snapshot,
    });

    // Persist edited reps/values/units back onto the saved workout (strip statuses).
    const workouts = getWorkouts();
    const idx = workouts.findIndex((w) => w.id === workoutId);
    if (idx !== -1) {
      workouts[idx] = {
        ...workouts[idx],
        exercises: workout.exercises.map((ex) => ({
          id: ex.id,
          name: ex.name,
          rest: ex.rest,
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

  const requestFinish = () => {
    // Confirm if any sets are still unfinished (neither done nor skipped).
    if (progress.total - progress.handled > 0) {
      setShowFinishConfirm(true);
    } else {
      handleFinish();
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
          <span className="tabular-nums">
            ⏱ {formatClock(elapsedSec)}
            <span className="text-muted-foreground/70"> / {formatEstimate(estimateSec)}</span>
          </span>
          <span>
            {progress.handled} / {progress.total} sets
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
                recommendForName={
                  exercise.name ||
                  workout.exercises
                    .slice(0, exIdx)
                    .reverse()
                    .find((e) => e.name)?.name ||
                  ""
                }
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => openInfoModal(exercise.name)}
                >
                  <Info className="size-4 text-primary" />
                  How to do it!
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-red-600 hover:text-red-700"
                  onClick={() => openVideoModal(exercise.name)}
                >
                  <Image src="/youtube.png" alt="" width={18} height={18} />
                  Videos
                </Button>
                <Select
                  value={exercise.rest === undefined || exercise.rest === "" ? "default" : exercise.rest}
                  onValueChange={(v) =>
                    setExerciseRest(exIdx, v === "default" ? undefined : v)
                  }
                >
                  <SelectTrigger
                    size="sm"
                    className="w-auto gap-1.5"
                    aria-label="Rest timer for this exercise"
                  >
                    <Timer className="size-4 text-primary" />
                    <SelectValue>{restTriggerLabel(exercise.rest, restSeconds)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {EXERCISE_REST_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {exercise.name.trim() && (
                <ExerciseStatsLine name={exercise.name} history={history} />
              )}

              {(() => {
                const exUnit =
                  exercise.sets[0]?.unit ?? inferUnit(exercise.sets[0]?.value ?? "");
                return (
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full table-fixed text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                          <th className="w-10 px-1 py-2 text-center font-medium">Set</th>
                          <th className="px-1 py-2 text-center font-medium">Reps</th>
                          <th className="px-1 py-1 text-center font-medium">
                            <button
                              type="button"
                              onClick={() => cycleExerciseUnit(exIdx)}
                              className="mx-auto inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-accent"
                              aria-label="Change unit"
                            >
                              {unitLabel(exUnit)}
                              <ChevronsUpDown className="size-3 opacity-60" />
                            </button>
                          </th>
                          <th className="w-14 px-1 py-2 text-center font-medium">Done</th>
                          <th className="w-9 px-1 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {exercise.sets.map((set, setIdx) => {
                          const rowStyle =
                            set.status === "done"
                              ? "bg-lime-50"
                              : set.status === "skipped"
                              ? "bg-muted opacity-70"
                              : "";
                          return (
                            <tr
                              key={set.id ?? setIdx}
                              className={`border-b last:border-b-0 ${rowStyle}`}
                            >
                              <td className="px-1 py-1.5 text-center text-muted-foreground">
                                {setIdx + 1}
                              </td>
                              <td className="px-1 py-1.5">
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  min={1}
                                  value={set.reps}
                                  onChange={(e) =>
                                    updateSetReps(exIdx, setIdx, parseInt(e.target.value) || 0)
                                  }
                                  className="h-8 w-full text-center"
                                  aria-label={`Reps for set ${setIdx + 1}`}
                                />
                              </td>
                              <td className="px-1 py-1.5">
                                {exUnit === "bw" ? (
                                  <div className="text-center text-muted-foreground">BW</div>
                                ) : (
                                  <Input
                                    type={exUnit === "time" ? "text" : "number"}
                                    inputMode={exUnit === "time" ? "text" : "decimal"}
                                    min={exUnit === "time" ? undefined : 0}
                                    value={set.value}
                                    onChange={(e) =>
                                      updateSetValue(exIdx, setIdx, e.target.value)
                                    }
                                    className="h-8 w-full text-center"
                                    placeholder={unitPlaceholder(exUnit)}
                                    aria-label="Value"
                                  />
                                )}
                              </td>
                              <td className="px-1 py-1.5 text-center">
                                <Button
                                  variant={
                                    set.status === "done"
                                      ? "default"
                                      : set.status === "skipped"
                                      ? "secondary"
                                      : "outline"
                                  }
                                  size="icon-sm"
                                  className="mx-auto"
                                  onClick={() => handleComplete(exIdx, setIdx)}
                                  aria-label={
                                    set.status === "done"
                                      ? "Set done — tap to skip"
                                      : set.status === "skipped"
                                      ? "Set skipped — tap to mark done"
                                      : "Mark set done"
                                  }
                                >
                                  {set.status === "skipped" ? (
                                    <SkipForward className="size-4" />
                                  ) : (
                                    <Check className="size-4" />
                                  )}
                                </Button>
                              </td>
                              <td className="px-1 py-1.5 text-center">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="mx-auto text-muted-foreground hover:text-destructive"
                                  onClick={() => removeSet(exIdx, setIdx)}
                                  disabled={exercise.sets.length === 1}
                                  aria-label={`Delete set ${setIdx + 1}`}
                                >
                                  <X className="size-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              <Button
                variant="outline"
                onClick={() => setAddSetFor(exIdx)}
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
        <DialogContent className="max-w-[calc(100%-1rem)] gap-3 p-3 sm:max-w-3xl sm:p-4">
          <DialogHeader className="text-left">
            <DialogTitle>Watch a demo</DialogTitle>
            <DialogDescription>
              {demoVideoId
                ? `A quick form demo for ${selectedExercise || "this exercise"}.`
                : `Reels & form tips for ${selectedExercise || "this exercise"}. Opens in a new tab.`}
            </DialogDescription>
          </DialogHeader>

          {demoVideoId ? (
            <div className="space-y-3">
              <div className="relative mx-auto aspect-video w-full max-h-[78svh] overflow-hidden rounded-lg bg-black">
                {/* Keyed by id + open so it only mounts (and stops) with the dialog. */}
                <iframe
                  key={`${demoVideoId}-${showVideoModal}`}
                  className="absolute inset-0 h-full w-full"
                  src={`https://www.youtube-nocookie.com/embed/${demoVideoId}?rel=0&modestbranding=1`}
                  title={`${selectedExercise} demo`}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() =>
                  window.open(
                    `https://www.youtube.com/results?search_query=${encodeURIComponent(
                      selectedExercise + " exercise form"
                    )}`,
                    "_blank",
                    "noopener,noreferrer"
                  )
                }
              >
                <span className="flex items-center gap-2">🔎 Search more on YouTube</span>
                <ExternalLink className="size-4" />
              </Button>
            </div>
          ) : (
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
          )}

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
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => setCountdown((c) => Math.max(0, c - 10))}
            >
              −10s
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => setCountdown((c) => c + 10)}
            >
              +10s
            </Button>
          </div>
          <Button
            variant="ghost"
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

      {/* Add set — copy previous or start fresh */}
      <Dialog
        open={addSetFor !== null}
        onOpenChange={(open) => {
          if (!open) setAddSetFor(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader className="text-left">
            <DialogTitle>Add a set</DialogTitle>
            <DialogDescription>
              Reuse the previous set&apos;s values, or start a fresh empty set?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => {
                if (addSetFor !== null) addSet(addSetFor, true);
                setAddSetFor(null);
              }}
            >
              Copy previous set
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (addSetFor !== null) addSet(addSetFor, false);
                setAddSetFor(null);
              }}
            >
              New empty set
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Finish confirmation when sets are still unfinished */}
      <ConfirmDialog
        open={showFinishConfirm}
        onOpenChange={setShowFinishConfirm}
        title="Finish workout?"
        description={`You still have ${progress.total - progress.handled} set${
          progress.total - progress.handled === 1 ? "" : "s"
        } left. Finish anyway?`}
        confirmLabel="Finish anyway"
        cancelLabel="Keep going"
        onConfirm={() => {
          setShowFinishConfirm(false);
          handleFinish();
        }}
      />

      <BottomActionBar>
        <Button variant="outline" className="flex-1" onClick={requestExit}>
          Cancel
        </Button>
        <Button className="flex-1" onClick={requestFinish}>
          Finish Workout
        </Button>
      </BottomActionBar>
    </PageContainer>
  );
};

export default StartWorkoutComponent;
