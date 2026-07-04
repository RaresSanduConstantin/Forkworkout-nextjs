"use client";

import * as React from "react";
import { Sparkles, ArrowLeft, Check, Clock, Dumbbell } from "lucide-react";
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
import {
  loadExerciseLibrary,
  getCachedLibrary,
  MUSCLE_GROUPS,
  EQUIPMENT_OPTIONS,
  EXPERIENCE_OPTIONS,
  GOAL_OPTIONS,
  type MuscleGroup,
  type EquipmentAccess,
  type Experience,
  type Goal,
  type LibraryExercise,
} from "@/lib/exercises";
import { generateWorkout } from "@/lib/workout-generator";
import { estimateWorkoutSeconds } from "@/lib/workout";
import { muscleScores, muscleHighlights } from "@/lib/muscle-map";
import { MuscleMapView } from "@/components/history/MuscleMapView";
import { getBodyProfile } from "@/lib/storage/profile";
import { getBodyMetrics } from "@/lib/storage/body-storage";
import { suggestNextWeight, getLastPerformance } from "@/lib/history-stats";
import { cn } from "@/lib/utils";
import type { Workout } from "@/lib/types";

const TIME_OPTIONS = [15, 30, 45, 60];

// Chip styling for the wrapped toggles: override the joined-group defaults so
// each item is individually rounded, bordered, evenly padded, and not stretched.
const chipItemClass =
  "!flex-none !rounded-md !border-l px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </div>
  );
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
  const [muscleGroups, setMuscleGroups] = React.useState<MuscleGroup[]>([]);
  const [secondaryGroups, setSecondaryGroups] = React.useState<MuscleGroup[]>([]);
  const [goal, setGoal] = React.useState<Goal>("muscle");
  const [equipment, setEquipment] = React.useState<EquipmentAccess>("gym");
  const [experience, setExperience] = React.useState<Experience>("beginner");
  const [minutes, setMinutes] = React.useState(30);

  // Step 2 (results): a few distinct variants the user can compare & pick from.
  const [step, setStep] = React.useState<"form" | "results">("form");
  const [variants, setVariants] = React.useState<Workout[]>([]);
  const [selected, setSelected] = React.useState(0);
  const [gender, setGender] = React.useState<"male" | "female">("male");

  React.useEffect(() => {
    if (!open) {
      setStep("form");
      return;
    }
    let active = true;
    loadExerciseLibrary().then((lib) => {
      if (active) setLibrary(lib);
    });
    return () => {
      active = false;
    };
  }, [open]);

  const handleGenerate = () => {
    if (muscleGroups.length === 0) {
      toast.error("Pick at least one muscle group.");
      return;
    }
    const profile = getBodyProfile();
    const latestWeight = [...getBodyMetrics()]
      .reverse()
      .find((m) => m.weightKg !== undefined)?.weightKg;
    const opts = {
      muscleGroups,
      secondaryGroups,
      equipment,
      experience,
      minutes,
      goal,
      sex: profile.sex ?? ("unspecified" as const),
      bodyweightKg: latestWeight,
      historyWeightKg: (name: string) =>
        suggestNextWeight(name) ?? getLastPerformance(name)?.topWeightKg ?? null,
    };

    // Build up to 3 distinct variants by rotating the generator seed.
    const seen = new Set<string>();
    const list: Workout[] = [];
    for (let seed = 0; list.length < 3 && seed < 8; seed++) {
      const w = generateWorkout(library, opts, seed);
      if (w.exercises.length === 0) continue;
      const sig = w.exercises.map((e) => e.name).join("|");
      if (seen.has(sig)) continue;
      seen.add(sig);
      list.push(w);
    }
    if (list.length === 0) {
      toast.error("No matching exercises — try different equipment or muscle groups.");
      return;
    }
    setGender(profile.sex === "female" ? "female" : "male");
    setVariants(list);
    setSelected(0);
    setStep("results");
  };

  const handleChoose = () => {
    const workout = variants[selected];
    if (!workout) return;
    onGenerate(workout);
    onOpenChange(false);
  };

  const previewHighlights = React.useMemo(() => {
    const workout = variants[selected];
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
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
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

        {step === "form" ? (
          <>
            <div className="space-y-5 py-2">
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

          <Field label="Primary muscle groups">
            <ToggleGroup
              type="multiple"
              value={muscleGroups}
              onValueChange={(v) => setMuscleGroups(v as MuscleGroup[])}
              variant="outline"
              className="flex flex-wrap justify-start gap-2"
            >
              {MUSCLE_GROUPS.map((g) => (
                <ToggleGroupItem
                  key={g}
                  value={g}
                  className={chipItemClass}
                >
                  {g}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>

          <Field label="Secondary groups (optional)">
            <ToggleGroup
              type="multiple"
              value={secondaryGroups}
              onValueChange={(v) => setSecondaryGroups(v as MuscleGroup[])}
              variant="outline"
              className="flex flex-wrap justify-start gap-2"
            >
              {MUSCLE_GROUPS.filter((g) => !muscleGroups.includes(g)).map((g) => (
                <ToggleGroupItem
                  key={g}
                  value={g}
                  className={chipItemClass}
                >
                  {g}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>

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
            </div>

            <DialogFooter>
              <Button className="w-full gap-2" onClick={handleGenerate}>
                <Sparkles className="size-4" />
                Show me options
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/30 p-2">
                <MuscleMapView highlights={previewHighlights} gender={gender} />
                <p className="mt-1 text-center text-xs text-muted-foreground">
                  Muscles this option targets
                </p>
              </div>

              <div className="space-y-2">
                {variants.map((w, i) => {
                  const secs = estimateWorkoutSeconds(w.exercises, w.rest);
                  const isSelected = i === selected;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setSelected(i)}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left transition-colors",
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">Option {i + 1}</span>
                        {isSelected && <Check className="size-4 text-primary" />}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Dumbbell className="size-3.5" />
                          {w.exercises.length} exercises
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" />~{Math.round(secs / 60)} min
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                        {w.exercises.map((e) => e.name).join(" · ")}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <DialogFooter className="flex-row gap-2">
              <Button variant="outline" className="flex-1 gap-2" onClick={() => setStep("form")}>
                <ArrowLeft className="size-4" />
                Back
              </Button>
              <Button className="flex-1 gap-2" onClick={handleChoose}>
                <Check className="size-4" />
                Use this
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
