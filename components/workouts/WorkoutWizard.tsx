"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
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
  type MuscleGroup,
  type EquipmentAccess,
  type Experience,
  type LibraryExercise,
} from "@/lib/exercises";
import { generateWorkout } from "@/lib/workout-generator";
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
  const [equipment, setEquipment] = React.useState<EquipmentAccess>("gym");
  const [experience, setExperience] = React.useState<Experience>("beginner");
  const [minutes, setMinutes] = React.useState(30);

  React.useEffect(() => {
    if (!open) return;
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
    const workout = generateWorkout(library, {
      muscleGroups,
      secondaryGroups,
      equipment,
      experience,
      minutes,
    });
    if (workout.exercises.length === 0) {
      toast.error("No matching exercises — try different equipment or muscle groups.");
      return;
    }
    onGenerate(workout);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Help me create a workout
          </DialogTitle>
          <DialogDescription>
            Answer a few quick questions and we&apos;ll build a routine you can tweak.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
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
            Create my workout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
