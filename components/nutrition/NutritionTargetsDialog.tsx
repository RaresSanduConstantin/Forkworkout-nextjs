"use client";

import * as React from "react";
import Link from "next/link";
import { Calculator, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { calorieTargets, computeAge, computeBMR, computeTDEE } from "@/lib/body-metrics";
import { ROUTES } from "@/lib/routes";
import { getBodyMetrics } from "@/lib/storage/body-storage";
import { getBodyProfile } from "@/lib/storage/profile";
import { saveNutritionTargets } from "@/lib/storage/nutrition-storage";
import type { NutritionTargets } from "@/lib/nutrition/types";

type Suggestion = { cut: number; maintain: number; bulk: number } | null;

function currentSuggestion(): { suggestion: Suggestion; missing: boolean } {
  const profile = getBodyProfile();
  const latestWeight = [...getBodyMetrics()]
    .reverse()
    .find((entry) => entry.weightKg !== undefined)?.weightKg;
  const age = computeAge(profile.birthYear);
  const bmr = computeBMR(latestWeight, profile.heightCm, age, profile.sex);
  const tdee = computeTDEE(bmr, profile.activity);
  return { suggestion: calorieTargets(tdee), missing: tdee === null };
}

export function NutritionTargetsDialog({
  open,
  onOpenChange,
  targets,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targets: NutritionTargets | null;
  onSaved: (targets: NutritionTargets) => void;
}) {
  const [calories, setCalories] = React.useState("");
  const [protein, setProtein] = React.useState("");
  const [carbs, setCarbs] = React.useState("");
  const [fat, setFat] = React.useState("");
  const [profileSuggestion, setProfileSuggestion] = React.useState<ReturnType<
    typeof currentSuggestion
  > | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setCalories(targets ? String(targets.caloriesKcal) : "");
    setProtein(targets ? String(targets.proteinG) : "");
    setCarbs(targets ? String(targets.carbsG) : "");
    setFat(targets ? String(targets.fatG) : "");
    setProfileSuggestion(currentSuggestion());
  }, [open, targets]);

  const save = () => {
    const values = {
      caloriesKcal: Number.parseFloat(calories),
      proteinG: protein.trim() ? Number.parseFloat(protein) : 0,
      carbsG: carbs.trim() ? Number.parseFloat(carbs) : 0,
      fatG: fat.trim() ? Number.parseFloat(fat) : 0,
    };
    if (!Number.isFinite(values.caloriesKcal) || values.caloriesKcal <= 0) {
      toast.error("Enter a daily calorie target greater than zero.");
      return;
    }
    if ([values.proteinG, values.carbsG, values.fatG].some((value) => !Number.isFinite(value) || value < 0)) {
      toast.error("Macro targets cannot be negative.");
      return;
    }
    const saved = saveNutritionTargets(values);
    if (!saved) {
      toast.error("Couldn't save your nutrition targets.");
      return;
    }
    onSaved(saved);
    onOpenChange(false);
    toast.success("Nutrition targets saved");
  };

  const suggestion = profileSuggestion?.suggestion;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle>Daily nutrition targets</DialogTitle>
          <DialogDescription>
            Targets stay under your control. Profile suggestions are estimates and are only applied
            when you choose one.
          </DialogDescription>
        </DialogHeader>

        {suggestion ? (
          <div className="rounded-xl border bg-muted/30 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <p className="text-sm font-semibold">From your body profile</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([
                ["Cut", suggestion.cut],
                ["Maintain", suggestion.maintain],
                ["Gain", suggestion.bulk],
              ] as const).map(([label, value]) => (
                <Button
                  key={label}
                  type="button"
                  variant="outline"
                  className="h-auto flex-col gap-0.5 px-2 py-2"
                  onClick={() => setCalories(String(value))}
                >
                  <span className="text-xs">{label}</span>
                  <span className="font-semibold tabular-nums">{value}</span>
                </Button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Based on your latest weight and existing BMR/TDEE profile calculation.
            </p>
          </div>
        ) : profileSuggestion?.missing ? (
          <div className="rounded-xl border border-dashed p-3 text-sm">
            <div className="flex gap-2">
              <Calculator className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">Want a calorie suggestion?</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Add a current weight, height, birth year, sex, and activity level in Body.
                </p>
                <Button asChild variant="link" className="mt-1 h-auto p-0 text-xs">
                  <Link href={ROUTES.body} onClick={() => onOpenChange(false)}>
                    Complete body profile
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="nutrition-target-calories">Calories (kcal)</Label>
            <NumberInput
              id="nutrition-target-calories"
              value={calories}
              onChange={(event) => setCalories(event.target.value)}
              placeholder="e.g. 2300"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nutrition-target-protein">Protein (g)</Label>
            <NumberInput
              id="nutrition-target-protein"
              decimal
              value={protein}
              onChange={(event) => setProtein(event.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nutrition-target-carbs">Carbs (g)</Label>
            <NumberInput
              id="nutrition-target-carbs"
              decimal
              value={carbs}
              onChange={(event) => setCarbs(event.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nutrition-target-fat">Fat (g)</Label>
            <NumberInput
              id="nutrition-target-fat"
              decimal
              value={fat}
              onChange={(event) => setFat(event.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={save}>Save targets</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

