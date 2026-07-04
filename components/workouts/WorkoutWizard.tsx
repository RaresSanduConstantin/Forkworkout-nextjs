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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  loadExerciseLibrary,
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
} from "@/lib/exercises";
import { generateWorkout } from "@/lib/workout-generator";
import { estimateWorkoutSeconds } from "@/lib/workout";
import { muscleScores, muscleHighlights } from "@/lib/muscle-map";
import { MuscleMapView } from "@/components/history/MuscleMapView";
import { MuscleMapPicker } from "@/components/workouts/MuscleMapPicker";
import { getBodyProfile } from "@/lib/storage/profile";
import { updateBodyProfile } from "@/lib/storage/profile";
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
  const [goal, setGoal] = React.useState<Goal>("muscle");
  const [equipment, setEquipment] = React.useState<EquipmentAccess>("gym");
  const [experience, setExperience] = React.useState<Experience>("beginner");
  const [minutes, setMinutes] = React.useState(30);

  // Step 2 (results): a few distinct variants the user can compare & pick from.
  const [step, setStep] = React.useState<"form" | "results">("form");
  const [variants, setVariants] = React.useState<Workout[]>([]);
  const [selected, setSelected] = React.useState(0);
  const [gender, setGender] = React.useState<"male" | "female">("male");

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
      return;
    }
    setGender(getBodyProfile().sex === "female" ? "female" : "male");
    let active = true;
    loadExerciseLibrary().then((lib) => {
      if (active) setLibrary(lib);
    });
    return () => {
      active = false;
    };
  }, [open]);

  const handleGenerate = () => {
    if (targetMuscles.length === 0) {
      toast.error("Pick at least one muscle.");
      return;
    }
    const profile = getBodyProfile();
    const latestWeight = [...getBodyMetrics()]
      .reverse()
      .find((m) => m.weightKg !== undefined)?.weightKg;
    const opts = {
      targetMuscles,
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

              <Accordion
                type="single"
                collapsible
                value={`opt-${selected}`}
                onValueChange={(v) => {
                  if (v) setSelected(Number(v.split("-")[1]));
                }}
                className="space-y-2"
              >
                {variants.map((w, i) => {
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
                          <span className="font-medium">Option {i + 1}</span>
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
                        <ul className="space-y-1.5">
                          {w.exercises.map((ex) => (
                            <li
                              key={ex.id}
                              className="flex items-center justify-between gap-3 text-sm"
                            >
                              <span className="truncate">{ex.name}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {setSummary(ex)}
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
