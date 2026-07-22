"use client";

import * as React from "react";
import { Sparkles, ArrowLeft, Check, Clock, Dumbbell, Info, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  loadExerciseLibrary,
  retryExerciseLibrary,
  getCachedLibrary,
  MUSCLE_GROUPS,
  MUSCLE_TARGETS,
  EQUIPMENT_OPTIONS,
  EXPERIENCE_OPTIONS,
  GOAL_OPTIONS,
  targetsForGroup,
  type MuscleTargetKey,
  type EquipmentAccess,
  type Experience,
  type Goal,
  type LibraryExercise,
  getExerciseStableIdByName,
} from "@/lib/exercises";
import { generateWorkout } from "@/lib/workout-generator";
import { estimateWorkoutSeconds } from "@/lib/workout";
import { muscleScores, muscleHighlights } from "@/lib/muscle-map";
import { MuscleMapView } from "@/components/history/MuscleMapView";
import { MuscleMapPicker } from "@/components/workouts/MuscleMapPicker";
import { getBodyProfile } from "@/lib/storage/profile";
import { updateBodyProfile } from "@/lib/storage/profile";
import {
  HOME_EQUIPMENT_ITEMS,
  getHomeEquipment,
  saveHomeEquipment,
  resolveHomeEquipment,
  type HomeEquipmentKey,
} from "@/lib/storage/home-equipment";
import { getBodyMetrics } from "@/lib/storage/body-storage";
import { suggestNextWeight, getLastPerformance } from "@/lib/history-stats";
import { getCompletedWorkouts } from "@/lib/storage/history-storage";
import { getPerformanceFeedback } from "@/lib/storage/performance-feedback";
import { suggestNextWeightWithFeedback } from "@/lib/smart-workout/progression";
import { cn } from "@/lib/utils";
import type { Workout } from "@/lib/types";
import { ExercisePreferenceControl } from "@/components/exercises/ExercisePreferenceControl";
import { ExerciseInfoDialog } from "@/components/exercises/ExerciseInfoDialog";
import {
  getExercisePreferences,
  type ExercisePreference,
} from "@/lib/storage/exercise-preferences";
import {
  getDailyTrainingState,
  saveDailyTrainingState,
  type ReadinessLevel,
} from "@/lib/storage/daily-training-state";
import { toDayKey } from "@/lib/date/day-key";
import {
  WORKOUT_STRATEGIES,
  type WorkoutStrategy,
  type WorkoutRecommendationMetadata,
} from "@/lib/smart-workout/types";
import { summarizeMuscleTraining } from "@/lib/smart-workout/history-summary";
import {
  scoreMusclePriorities,
  selectRecommendedMuscles,
} from "@/lib/smart-workout/muscle-priority";
import {
  buildRecommendationReasons,
  historyConfidenceForCount,
} from "@/lib/smart-workout/explanations";

const TIME_OPTIONS = [15, 30, 45, 60];
const READINESS_OPTIONS: Array<{ value: ReadinessLevel; label: string }> = [
  { value: "great", label: "Great" },
  { value: "normal", label: "Normal" },
  { value: "tired", label: "Tired" },
  { value: "very-tired", label: "Very tired" },
];

// Chip styling for the wrapped toggles: override the joined-group defaults so
// each item is individually rounded, bordered, evenly padded, and not stretched.
const chipItemClass =
  "!flex-none !rounded-md !border-l px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground";

type GeneratedVariant = {
  workout: Workout;
  strategy: WorkoutStrategy;
  metadata: WorkoutRecommendationMetadata;
};

function parseOptionalPositiveNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </div>
  );
}

function DailyMusclePicker({
  value,
  onChange,
  gender,
  instruction,
}: {
  value: MuscleTargetKey[];
  onChange: (value: MuscleTargetKey[]) => void;
  gender: "male" | "female";
  instruction: string;
}) {
  const toggle = (muscle: MuscleTargetKey) =>
    onChange(value.includes(muscle) ? value.filter((item) => item !== muscle) : [...value, muscle]);
  return (
    <div className="space-y-2">
      <MuscleMapPicker
        value={value}
        onToggle={toggle}
        gender={gender}
        instruction={instruction}
      />
      <ToggleGroup
        type="multiple"
        value={value}
        onValueChange={(next) => onChange(next as MuscleTargetKey[])}
        variant="outline"
        className="flex flex-wrap justify-start gap-1.5"
        aria-label={instruction}
      >
        {MUSCLE_TARGETS.map((muscle) => (
          <ToggleGroupItem
            key={muscle.key}
            value={muscle.key}
            className={chipItemClass}
          >
            {muscle.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

/** Short per-exercise set summary, e.g. "3×10 · 25kg" or "3×12 · BW". */
function setSummary(ex: Workout["exercises"][number]): string {
  const working = ex.sets.filter((s) => s.type !== "warmup");
  const s = working[0] ?? ex.sets[0];
  if (!s) return "";
  const load =
    s.unit === "bw"
      ? "BW"
      : s.unit === "time"
        ? s.value
        : s.unit === "km"
          ? `${s.value}km`
          : `${s.value}kg`;
  return `${working.length}×${s.reps} · ${load}`;
}

/** Guided workout generator: pick muscles, equipment, experience & time. */
export function WorkoutWizard({
  open,
  onOpenChange,
  onGenerate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (workout: Workout) => void;
}) {
  const [library, setLibrary] = React.useState<LibraryExercise[]>(getCachedLibrary());
  const [targetMuscles, setTargetMuscles] = React.useState<MuscleTargetKey[]>([]);
  const [targetMode, setTargetMode] = React.useState<"recommended" | "manual">("recommended");
  const [goal, setGoal] = React.useState<Goal>("muscle");
  const [equipment, setEquipment] = React.useState<EquipmentAccess>("gym");
  const [homeOwned, setHomeOwned] = React.useState<HomeEquipmentKey[]>([]);
  const [dumbbellMax, setDumbbellMax] = React.useState("");
  const [kettlebellMax, setKettlebellMax] = React.useState("");
  const [experience, setExperience] = React.useState<Experience>("beginner");
  const [minutes, setMinutes] = React.useState(30);
  const [preferences, setPreferences] = React.useState<ExercisePreference[]>([]);
  const [readiness, setReadiness] = React.useState<ReadinessLevel>("normal");
  const [soreMuscles, setSoreMuscles] = React.useState<MuscleTargetKey[]>([]);
  const [avoidMuscles, setAvoidMuscles] = React.useState<MuscleTargetKey[]>([]);

  // Step 2 (results): a few distinct variants the user can compare & pick from.
  const [step, setStep] = React.useState<"form" | "results">("form");
  const [variants, setVariants] = React.useState<GeneratedVariant[]>([]);
  const [selected, setSelected] = React.useState(0);
  const [gender, setGender] = React.useState<"male" | "female">("male");
  // True from tapping "Use this" until the modal unmounts/closes — shows a
  // loader because creating the workout then opening its editor takes a moment.
  const [creating, setCreating] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const generatingRef = React.useRef(false);
  const [libraryLoading, setLibraryLoading] = React.useState(getCachedLibrary().length === 0);
  const [libraryError, setLibraryError] = React.useState<string | null>(null);
  const [infoExerciseName, setInfoExerciseName] = React.useState<string | null>(null);

  const toggleMuscle = (k: MuscleTargetKey) =>
    setTargetMuscles((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  // Quick-add a whole region: select all its muscles, or clear them if all set.
  const toggleRegion = (keys: MuscleTargetKey[]) =>
    setTargetMuscles((prev) => {
      const allSet = keys.every((k) => prev.includes(k));
      return allSet
        ? prev.filter((k) => !keys.includes(k))
        : [...prev, ...keys.filter((k) => !prev.includes(k))];
    });

  const handleSex = (g: "male" | "female") => {
    setGender(g);
    updateBodyProfile({ sex: g });
  };

  React.useEffect(() => {
    if (!open) {
      setStep("form");
      setCreating(false);
      setInfoExerciseName(null);
      return;
    }
    setGender(getBodyProfile().sex === "female" ? "female" : "male");
    const he = getHomeEquipment();
    setHomeOwned(he.owned);
    setDumbbellMax(he.dumbbellMaxKg != null ? String(he.dumbbellMaxKg) : "");
    setKettlebellMax(he.kettlebellMaxKg != null ? String(he.kettlebellMaxKg) : "");
    setPreferences(getExercisePreferences());
    const dailyState = getDailyTrainingState();
    setReadiness(dailyState.readiness);
    setSoreMuscles(dailyState.soreMuscles);
    setAvoidMuscles(dailyState.avoidMuscles);
    let active = true;
    setLibraryError(null);
    setLibraryLoading(getCachedLibrary().length === 0);
    loadExerciseLibrary().then((lib) => {
      if (!active) return;
      setLibrary(lib);
      setLibraryLoading(false);
      setLibraryError(lib.length === 0 ? "The exercise library could not be loaded." : null);
    });
    return () => {
      active = false;
    };
  }, [open]);

  const handleRetryLibrary = async () => {
    setLibraryLoading(true);
    setLibraryError(null);
    const lib = await retryExerciseLibrary();
    setLibrary(lib);
    setLibraryLoading(false);
    setLibraryError(lib.length === 0 ? "The exercise library could not be loaded." : null);
  };

  const handleGenerate = () => {
    if (generatingRef.current || libraryLoading) return;
    if (libraryError || library.length === 0) {
      toast.error("The exercise library is not ready yet.");
      return;
    }
    if (targetMode === "manual" && targetMuscles.length === 0) {
      toast.error("Pick at least one muscle.");
      return;
    }
    if (
      targetMode === "manual" &&
      targetMuscles.every((muscle) => avoidMuscles.includes(muscle))
    ) {
      toast.error(
        "Every selected target is marked Avoid today. Choose another target or clear an avoidance."
      );
      return;
    }
    saveDailyTrainingState({
      date: toDayKey(),
      readiness,
      soreMuscles,
      avoidMuscles,
    });
    const profile = getBodyProfile();
    const latestWeight = [...getBodyMetrics()]
      .reverse()
      .find((m) => m.weightKg !== undefined)?.weightKg;
    const history = getCompletedWorkouts();
    const performanceFeedback = getPerformanceFeedback();
    const recentExerciseNames = history
      .filter((workout) => Number.isFinite(Date.parse(workout.date)))
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
      .slice(0, 3)
      .flatMap((workout) => workout.exercises?.map((exercise) => exercise.name) ?? []);
    const trainingSummary = summarizeMuscleTraining(history, library);
    const priorities = scoreMusclePriorities(trainingSummary, {
      experience,
      goal,
      soreMuscles,
      avoidMuscles,
      manuallySelectedMuscles: targetMode === "manual" ? targetMuscles : [],
    });
    const recommendedCount = minutes <= 15 ? 2 : minutes <= 45 ? 3 : 4;
    const selectedPriorities = selectRecommendedMuscles(priorities, recommendedCount);
    const generationTargets =
      targetMode === "recommended"
        ? selectedPriorities.map((priority) => priority.muscle)
        : targetMuscles;
    if (generationTargets.length === 0) {
      toast.error("No muscles are available after today's avoidance choices.");
      return;
    }

    // Resolve & remember home equipment (only relevant for the "home" option).
    let homeEquipment: ReturnType<typeof resolveHomeEquipment> | undefined;
    if (equipment === "home") {
      const parsedDumbbellMax = parseOptionalPositiveNumber(dumbbellMax);
      const parsedKettlebellMax = parseOptionalPositiveNumber(kettlebellMax);
      if (dumbbellMax.trim() && parsedDumbbellMax === undefined) {
        toast.error("Enter a positive dumbbell maximum.");
        return;
      }
      if (kettlebellMax.trim() && parsedKettlebellMax === undefined) {
        toast.error("Enter a positive kettlebell maximum.");
        return;
      }
      const he = {
        owned: homeOwned,
        dumbbellMaxKg: parsedDumbbellMax,
        kettlebellMaxKg: parsedKettlebellMax,
      };
      saveHomeEquipment(he);
      homeEquipment = resolveHomeEquipment(he);
    }

    const opts = {
      targetMuscles: generationTargets,
      equipment,
      experience,
      minutes,
      goal,
      sex: profile.sex ?? ("unspecified" as const),
      bodyweightKg: latestWeight,
      historyWeightKg: (name: string) => {
        const exercise = library.find(
          (item) => item.name.trim().toLowerCase() === name.trim().toLowerCase()
        );
        if (exercise) {
          return suggestNextWeightWithFeedback(exercise, performanceFeedback, history);
        }
        return (
          suggestNextWeight(name, history) ??
          getLastPerformance(name, history)?.topWeightKg ??
          null
        );
      },
      homeEquipment,
      preferences,
      readiness,
      soreMuscles,
      avoidMuscles,
      recentExerciseNames,
    };

    // Each option has a distinct planning strategy. A seed is only used as a
    // small deterministic tie-breaker inside that strategy.
    const seen = new Set<string>();
    const list: GeneratedVariant[] = [];
    generatingRef.current = true;
    setGenerating(true);
    for (let index = 0; index < WORKOUT_STRATEGIES.length; index += 1) {
      const definition = WORKOUT_STRATEGIES[index];
      let workout: Workout | null = null;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const candidate = generateWorkout(
          library,
          { ...opts, strategy: definition.value },
          index + attempt * WORKOUT_STRATEGIES.length
        );
        if (candidate.exercises.length === 0) continue;
        const signature = candidate.exercises.map((exercise) => exercise.name).join("|");
        if (!seen.has(signature) || attempt === 3) {
          seen.add(signature);
          workout = candidate;
          break;
        }
      }
      if (!workout) continue;
      const summary =
        definition.value === "progressive" && performanceFeedback.length > 0
          ? "Uses your saved exercise feedback and load history where available."
          : definition.value === "low-fatigue" && readiness !== "normal"
            ? `Uses fewer sets because you selected ${readiness.replace("-", " ")}.`
            : definition.description;
      workout.recommendationSummary = summary;
      const { reasons, warnings } = buildRecommendationReasons({
        targetMode,
        selectedPriorities,
        completedWorkoutCount: history.length,
        readiness,
        soreMuscles,
        avoidMuscles,
        equipment,
      });
      const metadata: WorkoutRecommendationMetadata = {
        strategy: definition.value,
        title: definition.title,
        summary,
        reasons,
        warnings,
        estimatedMinutes: Math.round(estimateWorkoutSeconds(workout.exercises, workout.rest) / 60),
        historyConfidence: historyConfidenceForCount(history.length),
      };
      workout.recommendation = metadata;
      list.push({ workout, strategy: definition.value, metadata });
    }
    generatingRef.current = false;
    setGenerating(false);
    if (list.length === 0) {
      toast.error("No matching exercises — try different equipment or muscle groups.");
      return;
    }
    setVariants(list);
    setSelected(0);
    setStep("results");
  };

  const handleChoose = () => {
    const variant = variants[selected];
    if (!variant || creating) return;
    // Show a loader and keep the modal up: onGenerate navigates to the editor
    // (which unmounts us) or resets in place (the caller then closes us). Either
    // way the user gets feedback instead of a blank pause on /app.
    setCreating(true);
    onGenerate(variant.workout);
  };

  const previewHighlights = React.useMemo(() => {
    const workout = variants[selected]?.workout;
    if (!workout) return [];
    const scores = muscleScores(
      workout.exercises.map((ex) => ({
        name: ex.name,
        sets: ex.sets.map((s) => ({ status: "done" as const, type: s.type })),
      })),
      library
    );
    return muscleHighlights(scores);
  }, [variants, selected, library]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!flex max-h-[90vh] max-w-md !flex-col overflow-hidden">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            {step === "form" ? "Help me create a workout" : "Pick your workout"}
          </DialogTitle>
          <DialogDescription>
            {step === "form"
              ? "Answer a few quick questions and we'll build a routine you can tweak."
              : "Tap an option to preview the muscles it targets, then make it yours."}
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-6 flex-1 overflow-y-auto px-6">
          {step === "form" ? (
            <div className="space-y-5 py-1">
          {libraryLoading && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm" role="status">
              <Loader2 className="size-4 animate-spin" />
              Loading the exercise library…
            </div>
          )}
          {libraryError && (
            <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3" role="alert">
              <p className="text-sm text-destructive">{libraryError}</p>
              <Button type="button" size="sm" variant="outline" onClick={handleRetryLibrary}>
                <RefreshCw className="size-4" />
                Retry
              </Button>
            </div>
          )}

          <Field label="Choose a starting point">
            <ToggleGroup
              type="single"
              value={targetMode}
              onValueChange={(value) => value && setTargetMode(value as "recommended" | "manual")}
              variant="outline"
              className="grid grid-cols-2 gap-2"
              aria-label="Workout target mode"
            >
              <ToggleGroupItem value="recommended" className={cn(chipItemClass, "!w-full")}>
                Recommended Today
              </ToggleGroupItem>
              <ToggleGroupItem value="manual" className={cn(chipItemClass, "!w-full")}>
                Build Manually
              </ToggleGroupItem>
            </ToggleGroup>
            <p className="text-xs text-muted-foreground">
              {targetMode === "recommended"
                ? "Targets are selected from local history, recent volume, and how you feel today."
                : "You choose every target muscle, as before."}
            </p>
          </Field>

          <Field label="Your goal">
            <ToggleGroup
              type="single"
              value={goal}
              onValueChange={(v) => v && setGoal(v as Goal)}
              variant="outline"
              className="flex flex-wrap gap-2"
            >
              {GOAL_OPTIONS.map((o) => (
                <ToggleGroupItem key={o.value} value={o.value} className={chipItemClass} title={o.hint}>
                  {o.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>

          <Field label="Your sex">
            <ToggleGroup
              type="single"
              value={gender}
              onValueChange={(v) => v && handleSex(v as "male" | "female")}
              variant="outline"
              className="flex flex-wrap gap-2"
            >
              <ToggleGroupItem value="male" className={chipItemClass}>
                Men
              </ToggleGroupItem>
              <ToggleGroupItem value="female" className={chipItemClass}>
                Women
              </ToggleGroupItem>
            </ToggleGroup>
            <p className="text-xs text-muted-foreground">
              Sets the body map and calibrates suggested starting weights. Saved to your profile.
            </p>
          </Field>

          {targetMode === "manual" ? (
          <Field label="Target muscles">
            <MuscleMapPicker value={targetMuscles} onToggle={toggleMuscle} gender={gender} />
            <p className="text-xs text-muted-foreground">
              Tap muscles on the body, or use the chips below.
            </p>
            <div className="space-y-3">
              {MUSCLE_GROUPS.map((group) => {
                const regionKeys = targetsForGroup(group);
                if (regionKeys.length === 0) return null;
                const allSet = regionKeys.every((k) => targetMuscles.includes(k));
                return (
                  <div key={group} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">{group}</span>
                      <button
                        type="button"
                        onClick={() => toggleRegion(regionKeys)}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        {allSet ? "Clear" : "All"}
                      </button>
                    </div>
                    <ToggleGroup
                      type="multiple"
                      value={targetMuscles.filter((k) => regionKeys.includes(k))}
                      onValueChange={(v) =>
                        setTargetMuscles((prev) => [
                          ...prev.filter((k) => !regionKeys.includes(k)),
                          ...(v as MuscleTargetKey[]),
                        ])
                      }
                      variant="outline"
                      className="flex flex-wrap justify-start gap-2"
                    >
                      {MUSCLE_TARGETS.filter((t) => t.group === group).map((t) => (
                        <ToggleGroupItem key={t.key} value={t.key} className={chipItemClass}>
                          {t.label}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>
                );
              })}
            </div>
          </Field>
          ) : (
            <div className="rounded-lg border bg-primary/5 p-3 text-sm">
              <p className="font-medium">Recommended targets are chosen when you generate</p>
              <p className="mt-1 text-xs text-muted-foreground">
                New users receive a balanced setup-based choice. Returning users also use recent
                completed-set history. You can still edit the workout afterward.
              </p>
            </div>
          )}

          <Accordion type="single" collapsible className="rounded-lg border px-3">
            <AccordionItem value="preferences" className="border-b-0">
              <AccordionTrigger className="py-3 hover:no-underline">
                <span className="text-sm font-medium">
                  Exercise preferences{preferences.length > 0 ? ` (${preferences.length})` : ""}
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                {preferences.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Mark exercises as preferred or avoided from a workout option or during a
                    session. Your choices stay in this browser.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {preferences.map((preference) => {
                      const exerciseName = preference.exerciseName ?? "Saved exercise";
                      return (
                        <li
                          key={preference.exerciseId}
                          className="flex items-center justify-between gap-3 rounded-md bg-muted/40 p-2"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{exerciseName}</span>
                            <span className="block text-xs capitalize text-muted-foreground">
                              {preference.level}
                              {preference.reason ? ` · ${preference.reason}` : ""}
                            </span>
                          </span>
                          <ExercisePreferenceControl
                            compact
                            exerciseId={preference.exerciseId}
                            exerciseName={exerciseName}
                            onChange={() => setPreferences(getExercisePreferences())}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Field label="Equipment">
            <ToggleGroup
              type="single"
              value={equipment}
              onValueChange={(v) => v && setEquipment(v as EquipmentAccess)}
              variant="outline"
              className="flex flex-wrap gap-2"
            >
              {EQUIPMENT_OPTIONS.map((o) => (
                <ToggleGroupItem
                  key={o.value}
                  value={o.value}
                  className={chipItemClass}
                >
                  {o.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            {equipment === "home" && (
              <div className="mt-3 space-y-3 rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">
                  What do you have at home? Bodyweight exercises are always included.
                </p>
                <ToggleGroup
                  type="multiple"
                  value={homeOwned}
                  onValueChange={(v) => setHomeOwned(v as HomeEquipmentKey[])}
                  variant="outline"
                  className="flex flex-wrap justify-start gap-2"
                >
                  {HOME_EQUIPMENT_ITEMS.map((item) => (
                    <ToggleGroupItem key={item.key} value={item.key} className={chipItemClass}>
                      {item.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>

                {homeOwned.includes("dumbbells") && (
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>Heaviest dumbbell (kg)</span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={100}
                      placeholder="e.g. 8"
                      value={dumbbellMax}
                      onChange={(e) => setDumbbellMax(e.target.value)}
                      className="w-24"
                    />
                  </label>
                )}
                {homeOwned.includes("kettlebells") && (
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>Heaviest kettlebell (kg)</span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={100}
                      placeholder="e.g. 12"
                      value={kettlebellMax}
                      onChange={(e) => setKettlebellMax(e.target.value)}
                      className="w-24"
                    />
                  </label>
                )}
              </div>
            )}
          </Field>

          <Field label="Experience">
            <ToggleGroup
              type="single"
              value={experience}
              onValueChange={(v) => v && setExperience(v as Experience)}
              variant="outline"
              className="flex flex-wrap gap-2"
            >
              {EXPERIENCE_OPTIONS.map((o) => (
                <ToggleGroupItem
                  key={o.value}
                  value={o.value}
                  className={chipItemClass}
                >
                  {o.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>

          <Field label="Time available">
            <ToggleGroup
              type="single"
              value={String(minutes)}
              onValueChange={(v) => v && setMinutes(parseInt(v, 10))}
              variant="outline"
              className="flex flex-wrap gap-2"
            >
              {TIME_OPTIONS.map((m) => (
                <ToggleGroupItem
                  key={m}
                  value={String(m)}
                  className={chipItemClass}
                >
                  {m}m
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>

          <Field label="How do you feel today?">
            <ToggleGroup
              type="single"
              value={readiness}
              onValueChange={(value) => {
                if (!value) return;
                const next = value as ReadinessLevel;
                setReadiness(next);
                saveDailyTrainingState({
                  date: toDayKey(),
                  readiness: next,
                  soreMuscles,
                  avoidMuscles,
                });
              }}
              variant="outline"
              className="flex flex-wrap gap-2"
              aria-label="Readiness today"
            >
              {READINESS_OPTIONS.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  className={chipItemClass}
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {readiness === "very-tired" && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                Consider a short, lighter session or taking a rest day. Generated workouts will
                use fewer working sets.
                {minutes !== 15 && (
                  <Button
                    type="button"
                    variant="link"
                    size="xs"
                    className="ml-1 h-auto p-0"
                    onClick={() => setMinutes(15)}
                  >
                    Switch to 15 minutes
                  </Button>
                )}
              </div>
            )}

            <Accordion type="multiple" className="rounded-lg border px-3">
              <AccordionItem value="sore">
                <AccordionTrigger className="py-3 hover:no-underline">
                  <span className="text-sm">
                    Sore today{soreMuscles.length ? ` (${soreMuscles.length})` : ""}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Sore areas may still be trained, but with lower priority and fewer sets.
                  </p>
                  <DailyMusclePicker
                    value={soreMuscles}
                    onChange={(next) => {
                      const nextAvoid = avoidMuscles.filter((muscle) => !next.includes(muscle));
                      setSoreMuscles(next);
                      setAvoidMuscles(nextAvoid);
                      saveDailyTrainingState({
                        date: toDayKey(),
                        readiness,
                        soreMuscles: next,
                        avoidMuscles: nextAvoid,
                      });
                    }}
                    gender={gender}
                    instruction="Tap muscles that feel sore today"
                  />
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="avoid" className="border-b-0">
                <AccordionTrigger className="py-3 hover:no-underline">
                  <span className="text-sm">
                    Avoid today{avoidMuscles.length ? ` (${avoidMuscles.length})` : ""}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Direct work for these areas is excluded today. This is separate from normal
                    soreness and is not medical advice.
                  </p>
                  <DailyMusclePicker
                    value={avoidMuscles}
                    onChange={(next) => {
                      const nextSore = soreMuscles.filter((muscle) => !next.includes(muscle));
                      setAvoidMuscles(next);
                      setSoreMuscles(nextSore);
                      saveDailyTrainingState({
                        date: toDayKey(),
                        readiness,
                        soreMuscles: nextSore,
                        avoidMuscles: next,
                      });
                    }}
                    gender={gender}
                    instruction="Tap muscles to avoid today"
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            <p className="text-xs text-muted-foreground">
              Today&apos;s choices and recommendations stay in this browser.
            </p>
          </Field>
            </div>
          ) : (
            <div className="space-y-4 py-1">
              <div className="rounded-lg border bg-muted/30 p-2">
                <MuscleMapView highlights={previewHighlights} gender={gender} />
                <p className="mt-1 text-center text-xs text-muted-foreground">
                  Muscles this option targets
                </p>
              </div>

              <Accordion
                type="single"
                collapsible
                value={`opt-${selected}`}
                onValueChange={(v) => {
                  if (v) setSelected(Number(v.split("-")[1]));
                }}
                className="space-y-2"
              >
                {variants.map((variant, i) => {
                  const w = variant.workout;
                  const secs = estimateWorkoutSeconds(w.exercises, w.rest);
                  const isSelected = i === selected;
                  return (
                    <AccordionItem
                      key={w.id}
                      value={`opt-${i}`}
                      className={cn(
                        "rounded-lg border border-b px-3 last:border-b",
                        isSelected && "border-primary bg-primary/5 ring-1 ring-primary"
                      )}
                    >
                      <AccordionTrigger className="py-3 hover:no-underline">
                        <span className="flex flex-1 items-center justify-between gap-2 pr-2">
                          <span className="min-w-0 text-left">
                            <span className="block truncate font-medium">{variant.metadata.title}</span>
                            <span className="block text-xs font-normal text-muted-foreground">
                              {variant.metadata.summary}
                            </span>
                          </span>
                          <span className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Dumbbell className="size-3.5" />
                              {w.exercises.length}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="size-3.5" />~{Math.round(secs / 60)}m
                            </span>
                            {isSelected && <Check className="size-4 text-primary" />}
                          </span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="mb-3 space-y-1.5 rounded-md bg-muted/40 p-2.5 text-xs">
                          {variant.metadata.reasons.slice(0, 2).map((reason) => (
                            <p key={reason}>• {reason}</p>
                          ))}
                          {variant.metadata.warnings.map((warning) => (
                            <p key={warning} className="text-amber-700 dark:text-amber-400">
                              • {warning}
                            </p>
                          ))}
                          <p className="text-muted-foreground">
                            History confidence: {variant.metadata.historyConfidence}
                          </p>
                        </div>
                        <ul className="space-y-1.5">
                          {w.exercises.map((ex) => (
                            <li
                              key={ex.id}
                              className="flex items-center justify-between gap-2 text-sm"
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block truncate">{ex.name}</span>
                                <span className="block text-xs text-muted-foreground">
                                  {setSummary(ex)}
                                </span>
                              </span>
                              <span className="flex shrink-0 items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`How to do ${ex.name}`}
                                  onClick={() => setInfoExerciseName(ex.name)}
                                >
                                  <Info className="size-4" />
                                </Button>
                                <ExercisePreferenceControl
                                  compact
                                  exerciseId={getExerciseStableIdByName(library, ex.name)}
                                  exerciseName={ex.name}
                                  onChange={() => setPreferences(getExercisePreferences())}
                                />
                              </span>
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          )}
        </div>

        {step === "form" ? (
          <DialogFooter>
            <Button
              className="w-full gap-2"
              onClick={handleGenerate}
              disabled={libraryLoading || Boolean(libraryError) || generating}
            >
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {generating ? "Building options…" : "Show me options"}
            </Button>
          </DialogFooter>
        ) : (
          <DialogFooter className="flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              disabled={creating}
              onClick={() => setStep("form")}
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <Button className="flex-1 gap-2" disabled={creating} onClick={handleChoose}>
              {creating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  Use this
                </>
              )}
            </Button>
          </DialogFooter>
        )}

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
