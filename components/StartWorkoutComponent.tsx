"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { ArrowLeft, ArrowUpDown, Check, ChevronsUpDown, Flame, Info, Layers, ListChecks, Minus, Plus, RefreshCw, SkipForward, Target, Timer, Vibrate, VibrateOff, Volume2, VolumeX, X } from "lucide-react";

import { Button } from "./ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { CardContent } from "@/components/ui/card";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ExerciseCombobox } from "./ExerciseCombobox";
import { PageContainer } from "@/components/layout/PageContainer";
import { BottomActionBar } from "@/components/layout/BottomActionBar";
import { honkFont } from "@/lib/honkFont";
import { cn } from "@/lib/utils";

import { getWorkoutById, getWorkouts, saveWorkouts } from "@/lib/storage/workout-storage";
import { addCompletedWorkout, getCompletedWorkouts } from "@/lib/storage/history-storage";
import {
  getActiveSessionFor,
  saveActiveSession,
  clearActiveSession,
} from "@/lib/storage/session-storage";
import { getSettings, updateSettings } from "@/lib/storage/settings";
import { SOUNDS } from "@/lib/sound";
import { useWakeLock } from "@/hooks/useWakeLock";
import { inferUnit, setVolumeKg, setWeightKg, parseDuration, formatSetValue, unitPlaceholder, formatClock, formatEstimate, effectiveRestSeconds, estimateWorkoutSeconds, restDurationLabel, setTypeShort, SET_TYPES, EXERCISE_REST_OPTIONS } from "@/lib/workout";
import { loadExerciseLibrary, getExerciseDefaultUnit, getCachedLibrary, getExerciseStableIdByName, type LibraryExercise } from "@/lib/exercises";
import { ExerciseStatsLine } from "@/components/session/ExerciseStatsLine";
import { getLastSessionSets, getExercisePR, estimateOneRepMax, normalizeExName, getTypicalDurationSec } from "@/lib/history-stats";
import { muscleScores, muscleHighlights } from "@/lib/muscle-map";
import { useMannequinGender } from "@/lib/use-body-gender";
import { MuscleMapView } from "@/components/history/MuscleMapView";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ReorderExercisesDialog } from "@/components/exercises/ReorderExercisesDialog";
import { AddExerciseByMuscleDialog } from "@/components/exercises/AddExerciseByMuscleDialog";
import { ExercisePreferenceControl } from "@/components/exercises/ExercisePreferenceControl";
import { ReplaceExerciseDialog } from "@/components/exercises/ReplaceExerciseDialog";
import { ExerciseInfoDialog } from "@/components/exercises/ExerciseInfoDialog";
import { isBodyweightExercise } from "@/lib/smart-workout/exercise-eligibility";
import { getMovementPattern } from "@/lib/smart-workout/movement-patterns";
import {
  addPerformanceFeedback,
  type ExerciseDifficulty,
} from "@/lib/storage/performance-feedback";
import { setExercisePreference } from "@/lib/storage/exercise-preferences";
import { ROUTES } from "@/lib/routes";
import type { ActiveSession, CompletedSet, CompletedWorkout, SessionSet, SetStatus, SetType, SetUnit } from "@/lib/types";
import { toast } from "sonner";

const EXERCISE_DIFFICULTIES: Array<{
  value: ExerciseDifficulty;
  label: string;
}> = [
  { value: "easy", label: "Easy" },
  { value: "good", label: "Good" },
  { value: "hard", label: "Hard" },
  { value: "failed", label: "Failed" },
  { value: "painful", label: "Painful" },
];

/** Trigger text for the per-exercise rest dropdown. When the exercise has no
 *  override, show the effective workout default so the user knows the value. */
function restTriggerLabel(rest: string | undefined, defaultSec: number): string {
  if (rest === undefined || rest === "") {
    return `Rest Timer: Default (${restDurationLabel(defaultSec)})`;
  }
  const sec = parseInt(rest, 10) || 0;
  return `Rest Timer: ${restDurationLabel(sec)}`;
}

/**
 * Tiny per-set hint under an input: shows the last session's value, or a
 * coloured ▲/▼ delta once the user has entered a different value.
 */
function SetDelta({
  current,
  last,
  suffix = "",
}: {
  current: string | number;
  last: string | number | undefined;
  suffix?: string;
}) {
  const lst = typeof last === "number" ? last : parseFloat(String(last ?? ""));
  if (!Number.isFinite(lst)) return null;
  const curStr = String(current ?? "").trim();
  const cur = typeof current === "number" ? current : parseFloat(curStr);
  const hasCur = curStr !== "" && Number.isFinite(cur);

  if (!hasCur) {
    return (
      <div className="mt-1 text-center text-[10px] leading-none text-muted-foreground">
        last {last}
        {suffix}
      </div>
    );
  }
  const diff = Math.round((cur - lst) * 100) / 100;
  if (diff === 0) {
    return (
      <div className="mt-1 text-center text-[10px] leading-none text-muted-foreground">
        = last {last}
        {suffix}
      </div>
    );
  }
  const up = diff > 0;
  return (
    <div
      className={cn(
        "mt-1 text-center text-[10px] font-medium leading-none",
        up ? "text-emerald-600" : "text-amber-600"
      )}
    >
      {up ? "▲ +" : "▼ "}
      {diff}
      {suffix}
    </div>
  );
}

const StartWorkoutComponent = () => {
  const params = useParams();
  const workoutId = params.id as string;
  const router = useRouter();

  const [workout, setWorkout] = useState<ActiveSession | null>(null);
  // Id of a just-added exercise, to scroll to & briefly highlight it.
  const [highlightExId, setHighlightExId] = useState<string | null>(null);
  const [collapsedExerciseIds, setCollapsedExerciseIds] = useState<Set<string>>(
    () => new Set()
  );
  const completedExerciseIdsRef = useRef<Map<string, boolean>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [history, setHistory] = useState<CompletedWorkout[]>([]);

  const [resting, setResting] = useState(false);
  const [restMinimized, setRestMinimized] = useState(false);
  const [restSeconds, setRestSeconds] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restVibration, setRestVibration] = useState(true);
  const restVibrationRef = useRef(true);
  restVibrationRef.current = restVibration;
  const [restSound, setRestSound] = useState(true);
  const restSoundRef = useRef(true);
  restSoundRef.current = restSound;
  const [vibrationSupported, setVibrationSupported] = useState(false);
  const [restNextLabel, setRestNextLabel] = useState<string | null>(null);

  const [selectedExercise, setSelectedExercise] = useState<string>("");
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [library, setLibrary] = useState<LibraryExercise[]>(getCachedLibrary());
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showAddByMuscle, setShowAddByMuscle] = useState(false);
  const [replaceExerciseIndex, setReplaceExerciseIndex] = useState<number | null>(null);
  const [pendingReplacement, setPendingReplacement] = useState<{
    exerciseIndex: number;
    replacement: LibraryExercise;
  } | null>(null);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [addSetFor, setAddSetFor] = useState<number | null>(null);
  const [typeMenuFor, setTypeMenuFor] = useState<string | null>(null);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [confirmRemoveExIdx, setConfirmRemoveExIdx] = useState<number | null>(null);
  const [finishNotes, setFinishNotes] = useState("");
  const [finishRpe, setFinishRpe] = useState<number | null>(null);
  const [finishCalories, setFinishCalories] = useState("");
  const [finishAvgBpm, setFinishAvgBpm] = useState("");
  const [finishMaxBpm, setFinishMaxBpm] = useState("");
  const [exerciseDifficulty, setExerciseDifficulty] = useState<
    Record<string, ExerciseDifficulty | undefined>
  >({});
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState<{
    volume: number;
    totalReps: number;
    setsDone: number;
    durationSec?: number;
    prs: string[];
  } | null>(null);

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
    restStartAudioRef.current.setAttribute("playsinline", "");
    restEndAudioRef.current.setAttribute("playsinline", "");
  }, []);

  const playAudio = (el: HTMLAudioElement | null) => {
    if (!el || !restSoundRef.current) return;
    try {
      // On iOS Safari, ambient mixes short cues with other media instead of
      // taking over the audio session and pausing background music.
      const nav = navigator as Navigator & {
        audioSession?: {
          type?: string;
        };
      };
      if (nav.audioSession && nav.audioSession.type !== "ambient") {
        nav.audioSession.type = "ambient";
      }
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
      const nav = navigator as Navigator & {
        audioSession?: {
          type?: string;
        };
      };
      if (nav.audioSession && nav.audioSession.type !== "ambient") {
        nav.audioSession.type = "ambient";
      }
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

  // Load exercise reference data (bundled + custom) for stats and preferences.
  useEffect(() => {
    let active = true;
    loadExerciseLibrary()
      .then((lib) => {
        if (active) {
          setLibrary(lib);
        }
      })
      .catch((error) => console.error("Failed to load exercises:", error));
    return () => {
      active = false;
    };
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
      // Resume a still-running rest countdown (minimized), or drop a stale one.
      if (saved.restTimer && saved.restTimer.endsAt > Date.now()) {
        setRestEndsAt(saved.restTimer.endsAt);
        setRestNextLabel(saved.restTimer.nextLabel ?? null);
        setCountdown(Math.max(0, Math.round((saved.restTimer.endsAt - Date.now()) / 1000)));
        setRestMinimized(true);
        setResting(true);
      } else if (saved.restTimer) {
        setWorkout((prev) => (prev ? { ...prev, restTimer: null } : prev));
      }
    } else if (found) {
      setWorkout({
        workoutId: found.id,
        title: found.title,
        startedAt: new Date().toISOString(),
        exercises: found.exercises.map((ex) => ({
          id: ex.id ?? uuidv4(),
          name: ex.name,
          rest: ex.rest,
          superset: ex.superset,
          movementPattern: ex.movementPattern,
          unilateral: ex.unilateral,
          sets: ex.sets.map((s) => ({
            id: s.id ?? uuidv4(),
            reps: s.reps,
            value: s.value,
            unit: s.unit ?? inferUnit(s.value),
            type: s.type,
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

  // Load the rest-vibration / sound preferences once (client-side).
  useEffect(() => {
    const s = getSettings();
    setRestVibration(s.restVibration);
    setRestSound(s.restSound);
    setVibrationSupported(
      typeof navigator !== "undefined" && typeof navigator.vibrate === "function"
    );
  }, []);

  // Persist the rest countdown into the active session (absolute end time) so it
  // shows in the global "in progress" bar and resumes when returning here.
  const persistRestTimer = (timer: { endsAt: number; nextLabel?: string } | null) => {
    setWorkout((prev) => (prev ? { ...prev, restTimer: timer } : prev));
  };

  // Rest countdown timer with cleanup and end sound + vibration. Derives the
  // remaining seconds from the absolute end time, so it stays correct across
  // navigation, refresh and device sleep. Runs whether expanded or minimized.
  useEffect(() => {
    if (!resting || restEndsAt == null) return;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      setResting(false);
      setRestMinimized(false);
      setRestEndsAt(null);
      setCountdown(0);
      persistRestTimer(null);
      playAudio(restEndAudioRef.current);
      if (restVibrationRef.current && typeof navigator !== "undefined") {
        navigator.vibrate?.([180, 80, 180]);
      }
    };
    const tick = () => {
      const remaining = Math.max(0, Math.round((restEndsAt - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) finish();
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [resting, restEndsAt]);

  // Stop resting entirely (skip): closes the dialog/pill and resets the count.
  const stopRest = () => {
    setResting(false);
    setRestMinimized(false);
    setCountdown(0);
    setRestEndsAt(null);
    persistRestTimer(null);
  };

  // Add/subtract time by moving the absolute end time (floored at "now").
  const adjustRest = (deltaSec: number) => {
    setRestEndsAt((cur) => {
      const base = cur ?? Date.now();
      const next = Math.max(Date.now(), base + deltaSec * 1000);
      persistRestTimer({ endsAt: next, nextLabel: restNextLabel ?? undefined });
      return next;
    });
  };

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

  // Prefer the real time this workout usually takes you (avg of recent sessions)
  // over the naive estimate; fall back to the estimate before any history.
  const typicalSec = useMemo(
    () => (workout ? getTypicalDurationSec(workout.workoutId, history) : null),
    [workout, history]
  );
  const targetSec = typicalSec ?? estimateSec;

  // Last-session sets per exercise, for the "beat your last numbers" hints.
  // Keyed on exercise names so it only recomputes when names (not set values)
  // change; history is snapshotted once at load.
  const exNamesKey = (workout?.exercises ?? []).map((e) => e.name).join("|");
  const lastSetsByName = useMemo(() => {
    const map: Record<string, CompletedSet[]> = {};
    for (const name of exNamesKey ? exNamesKey.split("|") : []) {
      const key = normalizeExName(name);
      if (name.trim() && !(key in map)) map[key] = getLastSessionSets(name, history);
    }
    return map;
  }, [exNamesKey, history]);

  // Live muscle highlights from the sets completed so far this session.
  const muscleHighlightData = useMemo(() => {
    if (!workout) return null;
    return muscleHighlights(muscleScores(workout.exercises, library));
  }, [workout, library]);
  const gender = useMannequinGender();

  // Pre-session PR snapshot per exercise, taken once when the session loads, so
  // a set is compared against the record it needs to beat (not against itself).
  const prSnapshotRef = useRef<Record<string, ReturnType<typeof getExercisePR>>>({});
  const celebratedRef = useRef<Set<string>>(new Set());
  const snapshotDoneRef = useRef(false);
  useEffect(() => {
    if (snapshotDoneRef.current || !loaded || !workout) return;
    snapshotDoneRef.current = true;
    const snap: Record<string, ReturnType<typeof getExercisePR>> = {};
    for (const ex of workout.exercises) {
      const key = normalizeExName(ex.name);
      if (ex.name.trim() && !(key in snap)) snap[key] = getExercisePR(ex.name, history);
    }
    prSnapshotRef.current = snap;
  }, [loaded, workout, history]);

  // Fire a celebration toast the first time a done set beats the pre-session PR
  // for that exercise (only when a prior record existed to beat).
  const celebratePR = (exIdx: number, set: SessionSet | undefined) => {
    if (!set) return;
    const ex = workout?.exercises[exIdx];
    if (!ex) return;
    const key = normalizeExName(ex.name);
    if (celebratedRef.current.has(key)) return;
    const pr = prSnapshotRef.current[key];
    if (!pr) return;

    const unit = set.unit ?? inferUnit(set.value);
    let label: string | null = null;
    if (unit === "kg") {
      const w = setWeightKg(set.value, unit);
      if (pr.maxWeightKg > 0 && w > pr.maxWeightKg) {
        label = `${w} kg × ${set.reps}`;
      } else if (pr.bestOneRepMax > 0) {
        const orm = estimateOneRepMax(w, set.reps);
        if (orm > pr.bestOneRepMax) label = `est. 1RM ~${Math.round(orm)} kg`;
      }
    } else if (unit === "bw") {
      if (pr.bestReps > 0 && set.reps > pr.bestReps) label = `${set.reps} reps`;
    } else if (unit === "time") {
      const d = parseDuration(set.value);
      if (pr.bestDurationSec > 0 && d > pr.bestDurationSec) {
        label = formatSetValue(`${d}s`, "time");
      }
    } else if (unit === "km") {
      const km = parseFloat(set.value) || 0;
      if (pr.bestDistanceKm > 0 && km > pr.bestDistanceKm) label = `${km} km`;
    }

    if (label) {
      celebratedRef.current.add(key);
      toast.success(`\uD83C\uDF89 New PR: ${ex.name} — ${label}!`);
    }
  };

  // Collapse an exercise once, at the moment its final pending set becomes
  // handled. A user can reopen it without this effect immediately closing it
  // again; adding a new pending set arms the automatic collapse for next time.
  useEffect(() => {
    if (!workout) {
      completedExerciseIdsRef.current = new Map();
      setCollapsedExerciseIds(new Set());
      return;
    }

    const nextCompletion = new Map<string, boolean>();
    const newlyCompleted: string[] = [];
    workout.exercises.forEach((exercise, index) => {
      const key = exercise.id ?? `exercise-${index}`;
      const complete =
        exercise.sets.length > 0 && exercise.sets.every((set) => set.status !== "pending");
      nextCompletion.set(key, complete);
      if (complete && completedExerciseIdsRef.current.get(key) !== true) {
        newlyCompleted.push(key);
      }
    });
    completedExerciseIdsRef.current = nextCompletion;

    setCollapsedExerciseIds((current) => {
      const liveIds = new Set(nextCompletion.keys());
      const next = new Set([...current].filter((id) => liveIds.has(id)));
      newlyCompleted.forEach((id) => next.add(id));
      if (
        next.size === current.size &&
        [...next].every((id) => current.has(id))
      ) {
        return current;
      }
      return next;
    });
  }, [workout]);

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

  const openInfoModal = (exerciseName: string) => {
    setSelectedExercise(exerciseName);
    setShowInfoModal(true);
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

  // Quick +/- steppers (manual entry still works).
  const stepReps = (exIdx: number, setIdx: number, delta: number) => {
    const cur = workout?.exercises[exIdx]?.sets[setIdx]?.reps ?? 0;
    updateSetReps(exIdx, setIdx, Math.max(1, cur + delta));
  };
  const stepValue = (exIdx: number, setIdx: number, delta: number) => {
    const cur = parseFloat(workout?.exercises[exIdx]?.sets[setIdx]?.value ?? "") || 0;
    const next = Math.max(0, Math.round((cur + delta) * 100) / 100);
    updateSetValue(exIdx, setIdx, String(next));
  };

  const updateSetType = (exIdx: number, setIdx: number, type: SetType) =>
    updateSet(exIdx, setIdx, (s) => ({ ...s, type }));

  // Progressive overload: fill every non-warm-up kg set of an exercise with the
  // suggested next weight (one tap from the "Try X kg" hint).
  const applySuggestedWeight = (exIdx: number, weightKg: number) => {
    const ex = workout?.exercises[exIdx];
    if (!ex) return;
    ex.sets.forEach((s, setIdx) => {
      const unit = s.unit ?? inferUnit(s.value);
      if (unit === "kg" && s.type !== "warmup") {
        updateSetValue(exIdx, setIdx, String(weightKg));
      }
    });
    toast.success(`Set to ${weightKg} kg — go beat it 💪`);
  };

  // Label of the next set to do after the one at (exIdx, setIdx), for the rest
  // timer's "next up" preview.
  const nextUpLabel = (exIdx: number, setIdx: number): string | null => {
    if (!workout) return null;
    const ex = workout.exercises[exIdx];
    let next: { name: string; num: number; total: number; set: SessionSet } | null = null;
    if (ex && setIdx + 1 < ex.sets.length) {
      next = { name: ex.name, num: setIdx + 2, total: ex.sets.length, set: ex.sets[setIdx + 1] };
    } else {
      for (let j = exIdx + 1; j < workout.exercises.length; j++) {
        const nx = workout.exercises[j];
        if (nx.sets.length) {
          next = { name: nx.name, num: 1, total: nx.sets.length, set: nx.sets[0] };
          break;
        }
      }
    }
    if (!next) return null;
    const u = next.set.unit ?? inferUnit(next.set.value);
    const target =
      u === "bw" ? `${next.set.reps} reps` : `${next.set.reps} × ${formatSetValue(next.set.value, u)}`;
    return `${next.name || "Exercise"} · Set ${next.num}/${next.total} · ${target}`;
  };

  // Reorder exercises (drag-and-drop modal). Persisted via the save effect.
  const moveExercise = (from: number, to: number) => {
    setWorkout((prev) => {
      if (!prev) return prev;
      if (
        from === to ||
        from < 0 ||
        to < 0 ||
        from >= prev.exercises.length ||
        to >= prev.exercises.length
      ) {
        return prev;
      }
      const next = [...prev.exercises];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...prev, exercises: next };
    });
  };

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

  const setExerciseSuperset = (exIdx: number, superset: string | undefined) => {
    setWorkout((prev) =>
      prev
        ? {
            ...prev,
            exercises: prev.exercises.map((ex, i) =>
              i === exIdx ? { ...ex, superset } : ex
            ),
          }
        : prev
    );
  };

  // The last exercise of a contiguous superset block (used for combined rest:
  // in a true superset there's no rest between exercises, only after the round).
  const isLastInSupersetBlock = (exIdx: number): boolean => {
    const group = workout?.exercises[exIdx]?.superset;
    if (!group) return true;
    const next = workout?.exercises[exIdx + 1]?.superset;
    return next !== group;
  };

  const addExercise = (name = "", suppliedDetails?: LibraryExercise) => {
    const id = uuidv4();
    const details =
      suppliedDetails ??
      library.find((exercise) => exercise.name.trim().toLowerCase() === name.trim().toLowerCase());
    const unit =
      details?.defaultUnit ??
      getExerciseDefaultUnit(name) ??
      (details && isBodyweightExercise(details) ? "bw" : "kg");
    const movementPattern = details ? getMovementPattern(details) : undefined;
    setWorkout((prev) =>
      prev
        ? {
            ...prev,
            exercises: [
              ...prev.exercises,
              {
                id,
                name,
                movementPattern,
                unilateral: details?.unilateral ?? movementPattern === "lunge",
                sets: [
                  {
                    id: uuidv4(),
                    reps: 1,
                    value: unit === "bw" ? "BW" : "",
                    unit,
                    status: "pending",
                  },
                ],
              },
            ],
          }
        : prev
    );
    // Bring the new exercise into view (and briefly highlight it) so adding one
    // mid-workout keeps you in place instead of leaving it below the fold.
    setHighlightExId(id);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        document
          .querySelector(`[data-exercise-id="${id}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      })
    );
    window.setTimeout(() => setHighlightExId((cur) => (cur === id ? null : cur)), 1800);
  };

  const removeExercise = (exIdx: number) => {
    setWorkout((prev) =>
      prev
        ? { ...prev, exercises: prev.exercises.filter((_, i) => i !== exIdx) }
        : prev
    );
  };

  const requestRemoveExercise = (exIdx: number) => {
    const ex = workout?.exercises[exIdx];
    if (!ex) return;
    const hasData =
      !!ex.name.trim() ||
      ex.sets.some((s) => s.status === "done" || s.status === "skipped");
    if (hasData) {
      setConfirmRemoveExIdx(exIdx);
    } else {
      removeExercise(exIdx);
    }
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
                      type: last.type,
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
    // Custom exercises carry a default measurement unit — apply it to the sets.
    const unit = getExerciseDefaultUnit(name);
    setWorkout((prev) =>
      prev
        ? {
            ...prev,
            exercises: prev.exercises.map((ex, i) =>
              i !== exIdx
                ? ex
                : {
                    ...ex,
                    name,
                    sets: unit
                      ? ex.sets.map((s) => ({
                          ...s,
                          unit,
                          value: unit === "bw" ? "BW" : s.value === "BW" ? "" : s.value,
                        }))
                      : ex.sets,
                  }
            ),
          }
        : prev
    );
  };

  const applyExerciseReplacement = (
    exerciseIndex: number,
    replacement: LibraryExercise
  ) => {
    const current = workout?.exercises[exerciseIndex];
    if (!current) return;

    const currentUnit = current.sets[0]?.unit ?? inferUnit(current.sets[0]?.value ?? "");
    const nextUnit =
      replacement.defaultUnit ??
      getExerciseDefaultUnit(replacement.name) ??
      (isBodyweightExercise(replacement) ? "bw" : currentUnit === "bw" ? "kg" : currentUnit);
    const movementPattern = getMovementPattern(replacement);

    setWorkout((previous) =>
      previous
        ? {
            ...previous,
            exercises: previous.exercises.map((exercise, index) =>
              index !== exerciseIndex
                ? exercise
                : {
                    ...exercise,
                    name: replacement.name,
                    movementPattern,
                    unilateral: replacement.unilateral ?? movementPattern === "lunge",
                    sets: exercise.sets.map((set) => ({
                      ...set,
                      id: uuidv4(),
                      unit: nextUnit,
                      value: nextUnit === "bw" ? "BW" : "",
                      status: "pending" as const,
                      rpe: undefined,
                    })),
                  }
            ),
          }
        : previous
    );
    const accordionId = current.id ?? `exercise-${exerciseIndex}`;
    setCollapsedExerciseIds((collapsed) => {
      if (!collapsed.has(accordionId)) return collapsed;
      const next = new Set(collapsed);
      next.delete(accordionId);
      return next;
    });
    toast.success(`Replaced ${current.name} with ${replacement.name}`);
  };

  const handleReplacementSelection = (replacement: LibraryExercise) => {
    if (replaceExerciseIndex === null) return;
    const current = workout?.exercises[replaceExerciseIndex];
    if (!current) return;
    if (current.sets.some((set) => set.status !== "pending")) {
      setPendingReplacement({ exerciseIndex: replaceExerciseIndex, replacement });
      return;
    }
    applyExerciseReplacement(replaceExerciseIndex, replacement);
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
    celebratePR(exIdx, set);

    // True superset: don't rest between exercises in a group — only after the
    // last one. Nudge the user to move straight to the next exercise instead.
    if (!isLastInSupersetBlock(exIdx)) {
      const nextName = workout?.exercises[exIdx + 1]?.name;
      toast(nextName ? `Straight into ${nextName} — no rest` : "Straight to the next exercise — no rest");
      return;
    }

    const eff = effectiveRestSeconds(
      workout?.exercises[exIdx]?.rest,
      restSeconds ? String(restSeconds) : ""
    );
    if (!eff) return;
    const label = nextUpLabel(exIdx, setIdx);
    const endsAt = Date.now() + eff * 1000;
    setRestNextLabel(label);
    setCountdown(eff);
    setRestEndsAt(endsAt);
    setRestMinimized(false);
    setResting(true);
    persistRestTimer({ endsAt, nextLabel: label ?? undefined });
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

    // Total kg lifted this session = reps × weight over completed working sets
    // (warm-ups excluded).
    const volume = workout.exercises.reduce(
      (sum, ex) =>
        sum +
        ex.sets.reduce(
          (s, set) =>
            s +
            (set.status === "done" && set.type !== "warmup"
              ? setVolumeKg(set.reps, set.value, set.unit)
              : 0),
          0
        ),
      0
    );

    // Total reps over completed working sets (warm-ups excluded).
    const totalReps = workout.exercises.reduce(
      (sum, ex) =>
        sum +
        ex.sets.reduce(
          (s, set) => s + (set.status === "done" && set.type !== "warmup" ? set.reps : 0),
          0
        ),
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
        type: set.type,
        rpe: set.rpe,
      })),
    }));

    const completedAt = new Date().toISOString();
    addCompletedWorkout({
      workoutId: workout.workoutId,
      title: workout.title,
      date: completedAt,
      volume,
      totalReps,
      durationSec,
      exercises: snapshot,
      notes: finishNotes.trim() || undefined,
      rpe: finishRpe ?? undefined,
      calories: parseInt(finishCalories, 10) || undefined,
      avgHeartRate: parseInt(finishAvgBpm, 10) || undefined,
      maxHeartRate: parseInt(finishMaxBpm, 10) || undefined,
    });

    let painfulFeedbackCount = 0;
    for (const exercise of workout.exercises) {
      const exerciseId = getExerciseStableIdByName(library, exercise.name);
      const difficulty = exerciseDifficulty[exerciseId];
      if (!difficulty) continue;
      const workingSets = exercise.sets.filter((set) => set.type !== "warmup");
      const completedSets = workingSets.filter((set) => set.status === "done");
      const topWeightKg = completedSets.reduce(
        (top, set) => Math.max(top, setWeightKg(set.value, set.unit)),
        0
      );
      addPerformanceFeedback({
        workoutId: workout.workoutId,
        exerciseId,
        exerciseName: exercise.name,
        completedAt,
        difficulty,
        completedWorkingSets: completedSets.length,
        plannedWorkingSets: workingSets.length,
        topWeightKg: topWeightKg > 0 ? topWeightKg : undefined,
        completedReps: completedSets.map((set) => set.reps),
      });
      if (difficulty === "painful") {
        painfulFeedbackCount += 1;
        setExercisePreference({
          exerciseId,
          exerciseName: exercise.name,
          level: "avoid",
          reason: "discomfort",
        });
      }
    }
    if (painfulFeedbackCount > 0) {
      toast.warning(
        `${painfulFeedbackCount} painful exercise${painfulFeedbackCount === 1 ? " was" : "s were"} excluded from future generated workouts. Stop if an exercise causes pain.`
      );
    }

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
          superset: ex.superset,
          movementPattern: ex.movementPattern,
          unilateral: ex.unilateral,
          sets: ex.sets.map((set) => ({
            id: set.id,
            reps: set.reps,
            value: set.value,
            unit: set.unit,
            type: set.type,
          })),
        })),
        updatedAt: new Date().toISOString(),
      };
      saveWorkouts(workouts);
    }

    clearActiveSession();

    // Show a celebratory summary instead of navigating away immediately.
    const setsDone = workout.exercises.reduce(
      (s, ex) => s + ex.sets.filter((x) => x.status === "done").length,
      0
    );
    const prs = [
      ...new Set(
        workout.exercises
          .filter((ex) => ex.name.trim() && celebratedRef.current.has(normalizeExName(ex.name)))
          .map((ex) => ex.name)
      ),
    ];
    setSummary({ volume: Math.round(volume), totalReps, setsDone, durationSec, prs });
    setShowFinishConfirm(false);
    setShowSummary(true);
  };

  const requestExit = () => {
    // Always confirm once a session is underway — the timer is running even if
    // no sets are checked yet, so leaving silently would lose that progress.
    setShowExitConfirm(true);
  };

  const leaveSession = (deleteSession: boolean) => {
    setShowExitConfirm(false);
    if (deleteSession) clearActiveSession();
    router.push(ROUTES.dashboard);
  };

  const requestFinish = () => {
    // Block finishing while an exercise is incomplete (no name, or a set with no value).
    const incomplete = workout?.exercises.some((ex) => {
      if (!ex.name.trim()) return true;
      return ex.sets.some((s) => s.unit !== "bw" && !String(s.value ?? "").trim());
    });
    if (incomplete) {
      toast.error("Finish incomplete exercise", {
        description: "Name every exercise and fill in each set — or remove the empty one.",
      });
      return;
    }
    // Always open the finish dialog so notes / RPE can be logged.
    setShowFinishConfirm(true);
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
        {workout.exercises.length > 1 && (
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
      </div>

      <h1 className="break-words text-center text-4xl font-bold">
        {honkFont(workout.title)}
      </h1>

      {/* Progress (sticky so it stays visible while scrolling exercises) */}
      <div className="sticky top-0 z-30 -mx-4 mt-4 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mb-1.5 flex items-center justify-between text-sm text-muted-foreground">
          <span className="tabular-nums">
            ⏱ {formatClock(elapsedSec)}
            <span className="text-muted-foreground/70">
              {" "}
              / {formatEstimate(targetSec)}
              {typicalSec != null && " (your avg)"}
            </span>
          </span>
          <span>
            {progress.handled} / {progress.total} sets
          </span>
        </div>
        <Progress value={progress.percent} aria-label="Workout progress" />
      </div>

      {muscleHighlightData && (
        <Accordion
          type="single"
          collapsible
          defaultValue="muscles"
          className="mt-4 rounded-lg border px-4"
        >
          <AccordionItem value="muscles" className="border-b-0">
            <AccordionTrigger className="hover:no-underline">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Flame className="size-4 text-orange-500" />
                Muscles worked
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <MuscleMapView highlights={muscleHighlightData} gender={gender} />
              <p className="mt-1 text-center text-xs text-muted-foreground">
                Lights up as you complete sets — primary muscles solid, secondary paler.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      <div className="mt-6 space-y-4">
        {workout.exercises.map((exercise, exIdx) => {
          const exerciseAccordionId = exercise.id ?? `exercise-${exIdx}`;
          const handledSetCount = exercise.sets.filter(
            (set) => set.status !== "pending"
          ).length;
          const exerciseComplete =
            exercise.sets.length > 0 && handledSetCount === exercise.sets.length;
          const exerciseCollapsed = collapsedExerciseIds.has(exerciseAccordionId);
          const group = exercise.superset;
          const prevGroup = exIdx > 0 ? workout.exercises[exIdx - 1]?.superset : undefined;
          const nextGroup = workout.exercises[exIdx + 1]?.superset;
          const inGroup = !!group && (group === prevGroup || group === nextGroup);
          const isGroupStart = inGroup && group !== prevGroup;
          return (
            <div
              key={exercise.id ?? exIdx}
              data-exercise-id={exercise.id}
              className={cn(inGroup && "rounded-l-lg border-l-2 border-primary/60 pl-2")}
            >
              {isGroupStart && (
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-primary">
                  <ListChecks className="size-3.5" />
                  Superset {group} · no rest between these
                </div>
              )}
              <Accordion
                type="single"
                collapsible
                value={exerciseCollapsed ? "" : "details"}
                onValueChange={(value) =>
                  setCollapsedExerciseIds((current) => {
                    const next = new Set(current);
                    if (value) next.delete(exerciseAccordionId);
                    else next.add(exerciseAccordionId);
                    return next;
                  })
                }
                className={cn(
                  "rounded-xl border bg-card text-card-foreground shadow-sm",
                  exercise.id === highlightExId &&
                    "ring-2 ring-primary ring-offset-2 transition-shadow"
                )}
              >
                <AccordionItem value="details" className="border-b-0">
                  <AccordionTrigger
                    className="min-w-0 gap-2 overflow-hidden py-3 pl-4 pr-2 hover:no-underline"
                    action={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="mr-2 shrink-0 self-center text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${exercise.name || `exercise ${exIdx + 1}`}`}
                        onClick={() => requestRemoveExercise(exIdx)}
                      >
                        <X className="size-4" />
                      </Button>
                    }
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-base font-semibold">
                          {exercise.name || `Exercise ${exIdx + 1}`}
                        </span>
                        <span className="block text-xs font-normal text-muted-foreground">
                          {handledSetCount}/{exercise.sets.length} sets
                        </span>
                      </span>
                      {exerciseComplete && (
                        <Badge className="shrink-0 bg-lime-600 px-1.5 text-white hover:bg-lime-600 sm:px-2.5">
                          Complete
                        </Badge>
                      )}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="border-t pb-0">
                <CardContent className="space-y-3 p-4">
                  <div className="min-w-0">
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
                  </div>
              <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => openInfoModal(exercise.name)}
                >
                  <Info className="size-4 text-primary" />
                  How to
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setReplaceExerciseIndex(exIdx)}
                >
                  <RefreshCw className="size-4 text-primary" />
                  Replace
                </Button>
                <ExercisePreferenceControl
                  exerciseId={getExerciseStableIdByName(library, exercise.name)}
                  exerciseName={exercise.name}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t pt-2">
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
                <Select
                  value={exercise.superset || "none"}
                  onValueChange={(v) =>
                    setExerciseSuperset(exIdx, v === "none" ? undefined : v)
                  }
                >
                  <SelectTrigger
                    size="sm"
                    className="w-auto gap-1.5"
                    aria-label="Superset group"
                  >
                    <Layers className="size-4 text-primary" />
                    <SelectValue>
                      {exercise.superset ? `Superset ${exercise.superset}` : "Superset"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No superset</SelectItem>
                    {["A", "B", "C", "D", "E", "F"].map((g) => (
                      <SelectItem key={g} value={g}>
                        Superset {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              </div>

              {exercise.name.trim() && (
                <ExerciseStatsLine
                  name={exercise.name}
                  history={history}
                  onApply={(w) => applySuggestedWeight(exIdx, w)}
                />
              )}

              {(() => {
                const exUnit =
                  exercise.sets[0]?.unit ?? inferUnit(exercise.sets[0]?.value ?? "");
                const lastSets = lastSetsByName[normalizeExName(exercise.name)] ?? [];
                return (
                  <div className="space-y-2">
                    {exercise.sets.map((set, setIdx) => {
                      const rowStyle =
                        set.status === "done"
                          ? "border-lime-400/60 bg-lime-50 dark:bg-lime-500/10"
                          : set.status === "skipped"
                          ? "opacity-60"
                          : "";
                      const lastRef = lastSets[setIdx];
                      const setKey = `${exIdx}-${setIdx}`;
                      const curType = set.type ?? "working";
                      return (
                        <div
                          key={set.id ?? setIdx}
                          className={cn("rounded-lg border p-2.5", rowStyle)}
                        >
                          {/* Header: tappable set-type chip + delete */}
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <Popover
                              open={typeMenuFor === setKey}
                              onOpenChange={(o) => setTypeMenuFor(o ? setKey : null)}
                            >
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2.5 py-1 text-xs font-medium hover:bg-accent"
                                  aria-label={`Set ${setIdx + 1} type — tap to change`}
                                >
                                  Set {setIdx + 1}
                                  {setTypeShort(set.type) && (
                                    <span className="uppercase text-amber-600">
                                      · {setTypeShort(set.type)}
                                    </span>
                                  )}
                                  <ChevronsUpDown className="size-3 opacity-60" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent align="start" className="w-40 p-1">
                                <p className="px-2 py-1 text-xs text-muted-foreground">Set type</p>
                                {SET_TYPES.map((t) => (
                                  <button
                                    key={t.value}
                                    type="button"
                                    onClick={() => {
                                      updateSetType(exIdx, setIdx, t.value);
                                      setTypeMenuFor(null);
                                    }}
                                    className={cn(
                                      "flex w-full items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-accent",
                                      curType === t.value && "font-medium text-primary"
                                    )}
                                  >
                                    {t.label}
                                    {curType === t.value && <Check className="size-4" />}
                                  </button>
                                ))}
                              </PopoverContent>
                            </Popover>
                            {exercise.sets.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeSet(exIdx, setIdx)}
                                className="flex size-7 items-center justify-center rounded text-muted-foreground hover:text-destructive"
                                aria-label={`Delete set ${setIdx + 1}`}
                              >
                                <X className="size-4" />
                              </button>
                            )}
                          </div>

                          {/* Reps + value steppers + Done */}
                          <div className="flex items-start gap-2">
                            {/* Reps */}
                            <div className="min-w-0 flex-1">
                              <span className="mb-1 block text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Reps
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => stepReps(exIdx, setIdx, -1)}
                                  className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground hover:bg-accent active:scale-95"
                                  aria-label="Decrease reps"
                                >
                                  <Minus className="size-4" />
                                </button>
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  min={1}
                                  value={set.reps}
                                  onChange={(e) =>
                                    updateSetReps(exIdx, setIdx, parseInt(e.target.value) || 0)
                                  }
                                  className="h-9 w-full min-w-0 px-0.5 text-center"
                                  aria-label={`Reps for set ${setIdx + 1}`}
                                  onFocus={(event) => event.currentTarget.select()}
                                  onClick={(event) => event.currentTarget.select()}
                                />
                                <button
                                  type="button"
                                  onClick={() => stepReps(exIdx, setIdx, 1)}
                                  className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground hover:bg-accent active:scale-95"
                                  aria-label="Increase reps"
                                >
                                  <Plus className="size-4" />
                                </button>
                              </div>
                              {lastRef && exUnit !== "time" && (
                                <SetDelta current={set.reps} last={lastRef.reps} />
                              )}
                            </div>

                            {/* Value */}
                            <div className="min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => cycleExerciseUnit(exIdx)}
                                className="mx-auto mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
                                aria-label="Change unit"
                              >
                                {unitLabel(exUnit)}
                                <ChevronsUpDown className="size-3 opacity-60" />
                              </button>
                              {exUnit === "bw" ? (
                                <div className="flex h-9 items-center justify-center font-medium text-muted-foreground">
                                  BW
                                </div>
                              ) : exUnit === "time" ? (
                                <Input
                                  type="text"
                                  value={set.value}
                                  onChange={(e) => updateSetValue(exIdx, setIdx, e.target.value)}
                                  className="h-9 w-full text-center"
                                  placeholder={lastRef?.value || unitPlaceholder(exUnit)}
                                  aria-label="Value"
                                  onFocus={(event) => event.currentTarget.select()}
                                  onClick={(event) => event.currentTarget.select()}
                                />
                              ) : (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      stepValue(exIdx, setIdx, exUnit === "km" ? -0.5 : -2.5)
                                    }
                                    className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground hover:bg-accent active:scale-95"
                                    aria-label="Decrease value"
                                  >
                                    <Minus className="size-4" />
                                  </button>
                                  <NumberInput
                                    decimal
                                    value={set.value}
                                    onChange={(e) => updateSetValue(exIdx, setIdx, e.target.value)}
                                    className="h-9 w-full min-w-0 px-0.5 text-center"
                                  placeholder={lastRef?.value || unitPlaceholder(exUnit)}
                                  aria-label="Value"
                                  onFocus={(event) => event.currentTarget.select()}
                                  onClick={(event) => event.currentTarget.select()}
                                />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      stepValue(exIdx, setIdx, exUnit === "km" ? 0.5 : 2.5)
                                    }
                                    className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground hover:bg-accent active:scale-95"
                                    aria-label="Increase value"
                                  >
                                    <Plus className="size-4" />
                                  </button>
                                </div>
                              )}
                              {lastRef &&
                                exUnit !== "bw" &&
                                lastRef.value &&
                                lastRef.value !== "BW" && (
                                  <SetDelta
                                    current={set.value}
                                    last={lastRef.value}
                                    suffix={exUnit === "km" ? " km" : ""}
                                  />
                                )}
                            </div>

                            {/* Done */}
                            <div className="shrink-0">
                              <span className="mb-1 block text-[10px] leading-none" aria-hidden>
                                &nbsp;
                              </span>
                              <Button
                                variant={
                                  set.status === "done"
                                    ? "default"
                                    : set.status === "skipped"
                                    ? "secondary"
                                    : "outline"
                                }
                                size="icon"
                                className="size-11"
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
                                  <SkipForward className="size-5" />
                                ) : (
                                  <Check className="size-5" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          onClick={() => addExercise()}
          className="flex-1 gap-2 border-dashed"
        >
          <Plus className="size-4" />
          Add Exercise
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowAddByMuscle(true)}
          className="flex-1 gap-2 border-dashed"
        >
          <Target className="size-4" />
          Add by muscle
        </Button>
      </div>

      <AddExerciseByMuscleDialog
        open={showAddByMuscle}
        onOpenChange={setShowAddByMuscle}
        onPick={(name) => addExercise(name)}
      />

      <ReplaceExerciseDialog
        open={replaceExerciseIndex !== null}
        onOpenChange={(open) => {
          if (!open) setReplaceExerciseIndex(null);
        }}
        exerciseName={
          replaceExerciseIndex === null
            ? ""
            : workout.exercises[replaceExerciseIndex]?.name ?? ""
        }
        excludedNames={workout.exercises
          .filter((_exercise, index) => index !== replaceExerciseIndex)
          .map((exercise) => exercise.name)}
        onReplace={handleReplacementSelection}
      />

      <Dialog
        open={pendingReplacement !== null}
        onOpenChange={(open) => {
          if (!open) setPendingReplacement(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader className="text-left">
            <DialogTitle>Keep your completed sets?</DialogTitle>
            <DialogDescription>
              {pendingReplacement
                ? `You already logged sets for “${
                    workout.exercises[pendingReplacement.exerciseIndex]?.name ?? "this exercise"
                  }”. Replacing it will permanently reset that set progress.`
                : "Choose how to add this exercise."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => {
                if (!pendingReplacement) return;
                addExercise(
                  pendingReplacement.replacement.name,
                  pendingReplacement.replacement
                );
                toast.success(
                  `Added ${pendingReplacement.replacement.name} as a new exercise`
                );
                setPendingReplacement(null);
              }}
            >
              Keep sets &amp; add as new
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!pendingReplacement) return;
                applyExerciseReplacement(
                  pendingReplacement.exerciseIndex,
                  pendingReplacement.replacement
                );
                setPendingReplacement(null);
              }}
            >
              Replace &amp; reset set progress
            </Button>
            <Button variant="ghost" onClick={() => setPendingReplacement(null)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ExerciseInfoDialog
        exerciseName={selectedExercise}
        open={showInfoModal}
        onOpenChange={setShowInfoModal}
      />

      {/* Rest Timer — full dialog (minimizes to a pill instead of closing) */}
      <Dialog
        open={resting && !restMinimized}
        onOpenChange={(open) => {
          // Tapping outside / X minimizes to the pill; the countdown keeps going.
          if (!open) setRestMinimized(true);
        }}
      >
        <DialogContent
          className="max-h-[calc(100dvh-1rem)] w-[min(24rem,calc(100vw-1.5rem))] max-w-none gap-4 overflow-y-auto overscroll-contain p-4 text-center landscape:gap-2 landscape:py-3 sm:max-w-none sm:p-5"
          onInteractOutside={() => setRestMinimized(true)}
        >
          <DialogDescription className="sr-only">Rest timer countdown</DialogDescription>
          <DialogTitle className="text-2xl font-bold landscape:text-xl">{honkFont("Rest Time")}</DialogTitle>
          <div className="font-mono text-6xl font-bold text-primary tabular-nums landscape:text-4xl">
            {countdown}s
          </div>
          {restNextLabel && (
            <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Next up
              </span>
              <p className="mt-0.5 break-words font-medium">{restNextLabel}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 landscape:grid-cols-4">
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => adjustRest(-10)}
            >
              −10s
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => adjustRest(10)}
            >
              +10s
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setRestMinimized(true)}>
              Minimize
            </Button>
            <Button variant="ghost" className="flex-1" onClick={stopRest}>
              Skip Rest
            </Button>
          </div>
          <div className="flex flex-col items-center gap-1.5 landscape:flex-row landscape:flex-wrap landscape:justify-center landscape:gap-4">
            <button
              type="button"
              onClick={() => {
                const next = !restSound;
                setRestSound(next);
                updateSettings({ restSound: next });
              }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              aria-pressed={restSound}
            >
              {restSound ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
              Sound when rest ends: {restSound ? "On" : "Off"}
            </button>
            {vibrationSupported ? (
              <button
                type="button"
                onClick={() => {
                  const next = !restVibration;
                  setRestVibration(next);
                  updateSettings({ restVibration: next });
                }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                aria-pressed={restVibration}
              >
                {restVibration ? <Vibrate className="size-3.5" /> : <VibrateOff className="size-3.5" />}
                Vibrate when rest ends: {restVibration ? "On" : "Off"}
              </button>
            ) : (
              <p className="flex items-center gap-1.5 text-center text-xs text-muted-foreground">
                <VibrateOff className="size-3.5 shrink-0" />
                Vibration isn&apos;t supported on this device.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Minimized rest timer — floating pill that keeps counting down */}
      {resting && restMinimized && (
        <div className="fixed inset-x-0 bottom-20 z-50 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full border bg-background/95 py-2 pl-4 pr-2 shadow-lg backdrop-blur">
            <button
              type="button"
              onClick={() => setRestMinimized(false)}
              className="flex items-center gap-2 text-sm font-medium"
              aria-label="Reopen rest timer"
            >
              <Timer className="size-4 text-primary" />
              <span className="font-mono tabular-nums text-primary">Rest {countdown}s</span>
            </button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full text-muted-foreground hover:text-destructive"
              onClick={stopRest}
              aria-label="Skip rest"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={confirmRemoveExIdx !== null} onOpenChange={(o) => !o && setConfirmRemoveExIdx(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="text-left">
            <DialogTitle>Remove this exercise?</DialogTitle>
            <DialogDescription>
              {confirmRemoveExIdx !== null && workout?.exercises[confirmRemoveExIdx]?.name
                ? `"${workout.exercises[confirmRemoveExIdx].name}" and its sets will be removed from this session.`
                : "This exercise and its sets will be removed from this session."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={() => setConfirmRemoveExIdx(null)}>
              Keep it
            </Button>
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (confirmRemoveExIdx !== null) removeExercise(confirmRemoveExIdx);
                setConfirmRemoveExIdx(null);
              }}
            >
              Remove exercise
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="text-left">
            <DialogTitle>Leave this workout?</DialogTitle>
            <DialogDescription>
              You can keep it in progress and resume later, or discard it.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button onClick={() => setShowExitConfirm(false)}>Keep going</Button>
            <Button variant="outline" onClick={() => leaveSession(false)}>
              Leave &amp; keep for later
            </Button>
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => leaveSession(true)}
            >
              Leave &amp; delete session
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ReorderExercisesDialog
        open={reorderOpen}
        onOpenChange={setReorderOpen}
        items={workout.exercises.map((ex, i) => ({
          id: ex.id ?? String(i),
          title: ex.name?.trim() || `Exercise ${i + 1}`,
        }))}
        onMove={moveExercise}
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

      {/* Finish dialog — log session notes + RPE (and warn on unfinished sets) */}
      <Dialog open={showFinishConfirm} onOpenChange={setShowFinishConfirm}>
        <DialogContent className="max-h-[92vh] max-w-sm overflow-y-auto">
          <DialogHeader className="text-left">
            <DialogTitle>Finish workout?</DialogTitle>
            <DialogDescription>
              {progress.total - progress.handled > 0
                ? `You still have ${progress.total - progress.handled} set${
                    progress.total - progress.handled === 1 ? "" : "s"
                  } left. Log it anyway?`
                : "Nice work! Add a note or how it felt (optional)."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Accordion type="single" collapsible className="rounded-lg border px-3">
              <AccordionItem value="exercise-difficulty" className="border-b-0">
                <AccordionTrigger className="py-3 hover:no-underline">
                  <span className="text-left">
                    <span className="block text-sm font-medium">Exercise difficulty (optional)</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {Object.values(exerciseDifficulty).filter(Boolean).length > 0
                        ? `${Object.values(exerciseDifficulty).filter(Boolean).length} rated`
                        : "Rate individual exercises"}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    This adjusts future load suggestions. Painful exercises will be avoided.
                  </p>
                  {workout.exercises.map((exercise) => {
                    const exerciseId = getExerciseStableIdByName(library, exercise.name);
                    return (
                      <div
                        key={exercise.id ?? exerciseId}
                        className="space-y-1.5 rounded-lg border p-2.5"
                      >
                        <p className="truncate text-sm font-medium">{exercise.name}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {EXERCISE_DIFFICULTIES.map((option) => (
                            <Button
                              key={option.value}
                              type="button"
                              size="xs"
                              variant={
                                exerciseDifficulty[exerciseId] === option.value
                                  ? option.value === "painful"
                                    ? "destructive"
                                    : "default"
                                  : "outline"
                              }
                              aria-pressed={exerciseDifficulty[exerciseId] === option.value}
                              onClick={() =>
                                setExerciseDifficulty((current) => ({
                                  ...current,
                                  [exerciseId]:
                                    current[exerciseId] === option.value ? undefined : option.value,
                                }))
                              }
                            >
                              {option.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="space-y-1.5">
              <span className="text-sm font-medium">How did it feel? (RPE)</span>
              <div className="flex flex-wrap gap-1.5">
                {[6, 7, 8, 9, 10].map((n) => (
                  <Button
                    key={n}
                    type="button"
                    size="sm"
                    variant={finishRpe === n ? "default" : "outline"}
                    className="w-10"
                    onClick={() => setFinishRpe((cur) => (cur === n ? null : n))}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>
            <Textarea
              value={finishNotes}
              onChange={(e) => setFinishNotes(e.target.value)}
              placeholder="Notes — e.g. felt heavy, left knee tight…"
              rows={3}
              maxLength={500}
            />

            <div className="space-y-1.5">
              <span className="text-sm font-medium">From your watch (optional)</span>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={finishCalories}
                  onChange={(e) => setFinishCalories(e.target.value)}
                  placeholder="kcal"
                  aria-label="Calories burned"
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={finishAvgBpm}
                  onChange={(e) => setFinishAvgBpm(e.target.value)}
                  placeholder="avg bpm"
                  aria-label="Average heart rate"
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={finishMaxBpm}
                  onChange={(e) => setFinishMaxBpm(e.target.value)}
                  placeholder="max bpm"
                  aria-label="Max heart rate"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowFinishConfirm(false)}>
              Keep going
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setShowFinishConfirm(false);
                handleFinish();
              }}
            >
              Finish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workout summary — celebratory recap */}
      <Dialog
        open={showSummary}
        onOpenChange={(open) => {
          if (!open) {
            setShowSummary(false);
            router.push(ROUTES.dashboard);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto text-center sm:max-w-md">
          <DialogHeader className="text-center sm:text-center">
            <DialogTitle className="text-2xl">
              {honkFont("Workout complete!")} 🎉
            </DialogTitle>
            <DialogDescription>Nice work — here&apos;s how it went.</DialogDescription>
          </DialogHeader>

          {summary && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border p-3">
                  <div className="text-2xl font-bold tabular-nums">
                    {summary.durationSec != null ? formatClock(summary.durationSec) : "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">Time</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-2xl font-bold tabular-nums">{summary.setsDone}</div>
                  <div className="text-xs text-muted-foreground">Sets done</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-2xl font-bold tabular-nums">
                    {summary.volume.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">Volume (kg)</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-2xl font-bold tabular-nums">{summary.totalReps}</div>
                  <div className="text-xs text-muted-foreground">Total reps</div>
                </div>
              </div>

              {summary.prs.length > 0 && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  <p className="font-semibold">🏆 New personal record{summary.prs.length > 1 ? "s" : ""}!</p>
                  <p className="mt-0.5 text-muted-foreground">{summary.prs.join(", ")}</p>
                </div>
              )}

              {muscleHighlightData && muscleHighlightData.length > 0 && (
                <div>
                  <p className="mb-1 text-sm font-medium">Muscles worked</p>
                  <MuscleMapView highlights={muscleHighlightData} gender={gender} />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              className="w-full"
              onClick={() => {
                setShowSummary(false);
                router.push(ROUTES.dashboard);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
