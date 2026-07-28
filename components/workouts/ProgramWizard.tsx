"use client";

import * as React from "react";
import { ArrowLeft, Check, Clock, Dumbbell, Info, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import type { Workout } from "@/lib/types";
import {
  EQUIPMENT_OPTIONS,
  GOAL_OPTIONS,
  MUSCLE_TARGETS,
  getExerciseStableIdByName,
  loadExerciseLibrary,
  type EquipmentAccess,
  type Goal,
  type LibraryExercise,
  type MuscleTargetKey,
} from "@/lib/exercises";
import { generateWorkout } from "@/lib/workout-generator";
import { estimateWorkoutSeconds } from "@/lib/workout";
import { planProgramDays } from "@/lib/program-generator";
import { getBodyProfile } from "@/lib/storage/profile";
import { getBodyMetrics } from "@/lib/storage/body-storage";
import { getCompletedWorkouts } from "@/lib/storage/history-storage";
import { suggestNextWeight } from "@/lib/history-stats";
import {
  getExercisePreferences,
  type ExercisePreference,
} from "@/lib/storage/exercise-preferences";
import {
  HOME_EQUIPMENT_ITEMS,
  getHomeEquipment,
  resolveHomeEquipment,
  saveHomeEquipment,
  type HomeEquipmentKey,
} from "@/lib/storage/home-equipment";
import { MuscleMapPicker } from "@/components/workouts/MuscleMapPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ExerciseInfoDialog } from "@/components/exercises/ExerciseInfoDialog";
import { ExercisePreferenceControl } from "@/components/exercises/ExercisePreferenceControl";
import { recommendExerciseReplacements } from "@/lib/smart-workout/exercise-replacements";
import { isBodyweightExercise } from "@/lib/smart-workout/exercise-eligibility";

const ALL_TARGETS = MUSCLE_TARGETS.map((target) => target.key);
const chipClass =
  "!flex-none !rounded-md !border-l px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground";

export function ProgramWizard({
  open,
  onOpenChange,
  onBack,
  onGenerate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBack: () => void;
  onGenerate: (value: { title: string; workouts: Workout[] }) => void;
}) {
  const [step, setStep] = React.useState<"setup" | "review">("setup");
  const [title, setTitle] = React.useState("My Training Program");
  const [days, setDays] = React.useState(3);
  const [goal, setGoal] = React.useState<Goal>("muscle");
  const [equipment, setEquipment] = React.useState<EquipmentAccess>("gym");
  const [minutes, setMinutes] = React.useState(45);
  const [exerciseCount, setExerciseCount] = React.useState(5);
  const [workingSets, setWorkingSets] = React.useState(3);
  const [homeOwned, setHomeOwned] = React.useState<HomeEquipmentKey[]>([]);
  const [dumbbellMax, setDumbbellMax] = React.useState("");
  const [kettlebellMax, setKettlebellMax] = React.useState("");
  const [targets, setTargets] = React.useState<MuscleTargetKey[]>(ALL_TARGETS);
  const [workouts, setWorkouts] = React.useState<Workout[]>([]);
  const [library, setLibrary] = React.useState<LibraryExercise[]>([]);
  const [infoExerciseName, setInfoExerciseName] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [gender, setGender] = React.useState<"male" | "female">("male");

  React.useEffect(() => {
    if (open) {
      setGender(getBodyProfile().sex === "female" ? "female" : "male");
      const home = getHomeEquipment();
      setHomeOwned(home.owned);
      setDumbbellMax(home.dumbbellMaxKg === undefined ? "" : String(home.dumbbellMaxKg));
      setKettlebellMax(
        home.kettlebellMaxKg === undefined ? "" : String(home.kettlebellMaxKg)
      );
    } else {
      setStep("setup");
      setLoading(false);
    }
  }, [open]);

  const generate = async () => {
    if (!title.trim()) {
      toast.error("Give your program a name.");
      return;
    }
    if (targets.length === 0) {
      toast.error("Choose at least one target muscle.");
      return;
    }
    setLoading(true);
    const library = await loadExerciseLibrary();
    if (library.length === 0) {
      setLoading(false);
      toast.error("The exercise library could not be loaded.");
      return;
    }
    setLibrary(library);
    const profile = getBodyProfile();
    const history = getCompletedWorkouts();
    const bodyweightKg = [...getBodyMetrics()]
      .reverse()
      .find((entry) => entry.weightKg !== undefined)?.weightKg;
    const dumbbellMaxKg = dumbbellMax.trim() ? Number(dumbbellMax) : undefined;
    const kettlebellMaxKg = kettlebellMax.trim() ? Number(kettlebellMax) : undefined;
    if (
      equipment === "home" &&
      ((dumbbellMaxKg !== undefined && (!Number.isFinite(dumbbellMaxKg) || dumbbellMaxKg <= 0)) ||
        (kettlebellMaxKg !== undefined &&
          (!Number.isFinite(kettlebellMaxKg) || kettlebellMaxKg <= 0)))
    ) {
      setLoading(false);
      toast.error("Equipment weight limits must be positive numbers.");
      return;
    }
    const home =
      equipment === "home"
        ? { owned: homeOwned, dumbbellMaxKg, kettlebellMaxKg }
        : undefined;
    if (home) saveHomeEquipment(home);
    const homeEquipment = home ? resolveHomeEquipment(home) : undefined;
    const plans = planProgramDays(targets, days);
    const recentNames: string[] = [];
    const generated = plans.map((plan, index) => {
      const workout = generateWorkout(
        library,
        {
          targetMuscles: plan.targetMuscles,
          equipment,
          experience: "intermediate",
          minutes,
          exercisesPerWorkout: exerciseCount,
          workingSetsPerExercise: workingSets,
          goal,
          sex: profile.sex ?? "unspecified",
          bodyweightKg,
          homeEquipment,
          preferences: getExercisePreferences(),
          historyWeightKg: (name) => suggestNextWeight(name, history),
          recentExerciseNames: recentNames,
          strategy: "balanced",
        },
        index * 3
      );
      recentNames.push(...workout.exercises.map((exercise) => exercise.name));
      return {
        ...workout,
        title: plan.title,
        recommendationSummary: `${plan.title} in your ${days}-day ${title.trim()} rotation.`,
      };
    });
    setLoading(false);
    if (generated.some((workout) => workout.exercises.length === 0)) {
      toast.error("Some days had no matching exercises. Try more muscles or different equipment.");
      return;
    }
    setWorkouts(generated);
    setStep("review");
  };

  const toggleTarget = (target: MuscleTargetKey) => {
    setTargets((current) =>
      current.includes(target)
        ? current.filter((item) => item !== target)
        : [...current, target]
    );
  };

  const handlePreferenceChange = (
    workoutIndex: number,
    exerciseIndex: number,
    preference: ExercisePreference | null
  ) => {
    if (preference?.level !== "avoid") return;
    const currentWorkout = workouts[workoutIndex];
    const currentExercise = currentWorkout?.exercises[exerciseIndex];
    if (!currentWorkout || !currentExercise) return;
    const replacement = recommendExerciseReplacements({
      library,
      currentName: currentExercise.name,
      preferences: getExercisePreferences(),
      excludedNames: currentWorkout.exercises
        .filter((_exercise, index) => index !== exerciseIndex)
        .map((exercise) => exercise.name),
      limit: 1,
      scoringContext: {
        equipment,
        experience: "intermediate",
        homeEquipment:
          equipment === "home"
            ? resolveHomeEquipment({
                owned: homeOwned,
                dumbbellMaxKg: dumbbellMax.trim() ? Number(dumbbellMax) : undefined,
                kettlebellMaxKg: kettlebellMax.trim() ? Number(kettlebellMax) : undefined,
              })
            : undefined,
      },
    })[0]?.exercise;
    if (!replacement) {
      toast.warning(`No matching replacement was found for ${currentExercise.name}.`);
      return;
    }
    const bodyweight = isBodyweightExercise(replacement);
    const historyWeight = suggestNextWeight(replacement.name, getCompletedWorkouts());
    setWorkouts((current) =>
      current.map((workout, currentWorkoutIndex) =>
        currentWorkoutIndex !== workoutIndex
          ? workout
          : {
              ...workout,
              exercises: workout.exercises.map((exercise, currentExerciseIndex) =>
                currentExerciseIndex !== exerciseIndex
                  ? exercise
                  : {
                      ...exercise,
                      name: replacement.name,
                      sets: exercise.sets.map((set) => ({
                        ...set,
                        unit: bodyweight ? "bw" : "kg",
                        value: bodyweight
                          ? "BW"
                          : String(historyWeight ?? (set.unit === "kg" ? set.value || "10" : "10")),
                      })),
                    }
              ),
            }
      )
    );
    toast.success(`Replaced ${currentExercise.name} with ${replacement.name}.`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!flex max-h-[90dvh] max-w-lg !flex-col overflow-hidden">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            {step === "setup" ? "Build a workout program" : "Review your program"}
          </DialogTitle>
          <DialogDescription>
            {step === "setup"
              ? "Choose the rotation length and overall muscle focus."
              : "These workouts will be saved together as your active program."}
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-6 min-h-0 flex-1 space-y-5 overflow-y-auto px-6">
          {step === "setup" ? (
            <>
              <div className="space-y-1.5">
                <label htmlFor="wizard-program-name" className="text-sm font-medium">
                  Program name
                </label>
                <Input
                  id="wizard-program-name"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={60}
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Training days per rotation</p>
                <ToggleGroup
                  type="single"
                  value={String(days)}
                  onValueChange={(value) => value && setDays(Number(value))}
                  variant="outline"
                  className="flex flex-wrap justify-start gap-2"
                >
                  {[2, 3, 4, 5, 6].map((value) => (
                    <ToggleGroupItem key={value} value={String(value)} className={chipClass}>
                      {value} days
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Goal</p>
                <ToggleGroup
                  type="single"
                  value={goal}
                  onValueChange={(value) => value && setGoal(value as Goal)}
                  variant="outline"
                  className="flex flex-wrap justify-start gap-2"
                >
                  {GOAL_OPTIONS.map((option) => (
                    <ToggleGroupItem key={option.value} value={option.value} className={chipClass}>
                      {option.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Equipment</p>
                <ToggleGroup
                  type="single"
                  value={equipment}
                  onValueChange={(value) => value && setEquipment(value as EquipmentAccess)}
                  variant="outline"
                  className="flex flex-wrap justify-start gap-2"
                >
                  {EQUIPMENT_OPTIONS.map((option) => (
                    <ToggleGroupItem key={option.value} value={option.value} className={chipClass}>
                      {option.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                {equipment === "home" && (
                  <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">
                      Select what you have. Bodyweight exercises are always available.
                    </p>
                    <ToggleGroup
                      type="multiple"
                      value={homeOwned}
                      onValueChange={(value) => setHomeOwned(value as HomeEquipmentKey[])}
                      variant="outline"
                      className="flex flex-wrap justify-start gap-2"
                    >
                      {HOME_EQUIPMENT_ITEMS.map((item) => (
                        <ToggleGroupItem key={item.key} value={item.key} className={chipClass}>
                          {item.label}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                    {homeOwned.includes("dumbbells") && (
                      <label className="flex items-center justify-between gap-3 text-sm">
                        <span>Heaviest dumbbell (kg)</span>
                        <Input
                          type="number"
                          min={1}
                          value={dumbbellMax}
                          onChange={(event) => setDumbbellMax(event.target.value)}
                          className="w-24"
                          placeholder="e.g. 10"
                        />
                      </label>
                    )}
                    {homeOwned.includes("kettlebells") && (
                      <label className="flex items-center justify-between gap-3 text-sm">
                        <span>Heaviest kettlebell (kg)</span>
                        <Input
                          type="number"
                          min={1}
                          value={kettlebellMax}
                          onChange={(event) => setKettlebellMax(event.target.value)}
                          className="w-24"
                          placeholder="e.g. 16"
                        />
                      </label>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium">Exercises per workout</p>
                  <p className="text-xs text-muted-foreground">
                    Recommended: {minutes <= 15 ? 3 : minutes <= 30 ? 4 : minutes <= 45 ? 5 : 6} for {minutes} minutes.
                  </p>
                </div>
                <ToggleGroup
                  type="single"
                  value={String(exerciseCount)}
                  onValueChange={(value) => value && setExerciseCount(Number(value))}
                  variant="outline"
                  className="flex flex-wrap justify-start gap-2"
                >
                  {[3, 4, 5, 6, 7, 8].map((value) => (
                    <ToggleGroupItem key={value} value={String(value)} className={chipClass}>
                      {value}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium">
                    {goal === "stretch" ? "Rounds per stretch" : "Working sets per exercise"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {goal === "stretch"
                      ? "Each round is generated as a 30-second hold and can be edited afterward."
                      : "3 sets is a balanced default. Warm-up sets may be added separately."}
                  </p>
                </div>
                <ToggleGroup
                  type="single"
                  value={String(workingSets)}
                  onValueChange={(value) => value && setWorkingSets(Number(value))}
                  variant="outline"
                  className="flex flex-wrap justify-start gap-2"
                >
                  {[2, 3, 4, 5].map((value) => (
                    <ToggleGroupItem key={value} value={String(value)} className={chipClass}>
                      {value} {goal === "stretch" ? "rounds" : "sets"}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Minutes per workout</p>
                <ToggleGroup
                  type="single"
                  value={String(minutes)}
                  onValueChange={(value) => value && setMinutes(Number(value))}
                  variant="outline"
                  className="flex flex-wrap justify-start gap-2"
                >
                  {[15, 30, 45, 60].map((value) => (
                    <ToggleGroupItem key={value} value={String(value)} className={chipClass}>
                      {value}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Muscles to cover</p>
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => setTargets(targets.length === ALL_TARGETS.length ? [] : ALL_TARGETS)}
                  >
                    {targets.length === ALL_TARGETS.length ? "Clear all" : "Select all"}
                  </button>
                </div>
                <MuscleMapPicker value={targets} onToggle={toggleTarget} gender={gender} />
                <ToggleGroup
                  type="multiple"
                  value={targets}
                  onValueChange={(value) => setTargets(value as MuscleTargetKey[])}
                  variant="outline"
                  className="flex flex-wrap justify-start gap-1.5"
                >
                  {MUSCLE_TARGETS.map((target) => (
                    <ToggleGroupItem key={target.key} value={target.key} className={chipClass}>
                      {target.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            </>
          ) : (
            <div className="space-y-3 py-1">
              <Accordion
                type="single"
                collapsible
                defaultValue={workouts[0]?.id}
                className="space-y-3"
              >
                {workouts.map((workout, index) => {
                  const seconds = estimateWorkoutSeconds(workout.exercises, workout.rest);
                  return (
                <AccordionItem
                  key={workout.id}
                  value={workout.id}
                  className="rounded-xl border bg-card px-3"
                >
                  <div className="flex items-center gap-2 pt-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      {index + 1}
                    </span>
                    <Input
                      value={workout.title}
                      onChange={(event) =>
                        setWorkouts((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, title: event.target.value } : item
                          )
                        )
                      }
                      aria-label={`Workout ${index + 1} name`}
                    />
                  </div>
                  <AccordionTrigger className="py-3 hover:no-underline">
                    <span className="flex w-full items-center justify-between gap-3 pr-2 text-left">
                      <span className="text-sm text-muted-foreground">View workout details</span>
                      <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Dumbbell className="size-3.5" />
                          {workout.exercises.length}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" />~{Math.round(seconds / 60)}m
                        </span>
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="mb-2 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                      {workout.recommendationSummary}
                    </p>
                    <ul className="space-y-2">
                      {workout.exercises.map((exercise, exerciseIndex) => (
                        <li
                          key={exercise.id ?? exercise.name}
                          className="flex items-center justify-between gap-2 rounded-md border p-2"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {exercise.name}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {exercise.sets.filter((set) => set.type !== "warmup").length}{" "}
                              {goal === "stretch" ? "rounds" : "working sets"}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`How to do ${exercise.name}`}
                              onClick={() => setInfoExerciseName(exercise.name)}
                            >
                              <Info className="size-4" />
                            </Button>
                            <ExercisePreferenceControl
                              compact
                              exerciseId={getExerciseStableIdByName(library, exercise.name)}
                              exerciseName={exercise.name}
                              onChange={(preference) =>
                                handlePreferenceChange(index, exerciseIndex, preference)
                              }
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
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (step === "review") setStep("setup");
              else onBack();
            }}
          >
            <ArrowLeft className="size-4" /> Back
          </Button>
          {step === "setup" ? (
            <Button onClick={generate} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Generate program
            </Button>
          ) : (
            <Button
              onClick={() => onGenerate({ title: title.trim(), workouts })}
              disabled={workouts.some((workout) => !workout.title.trim())}
            >
              <Check className="size-4" /> Create program
            </Button>
          )}
        </DialogFooter>
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
