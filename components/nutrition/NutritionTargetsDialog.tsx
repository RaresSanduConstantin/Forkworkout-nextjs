"use client";

import * as React from "react";
import { Calculator, Dumbbell, Scale, Sparkles } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ACTIVITY_LEVELS, computeAge, computeBMR, computeTDEE } from "@/lib/body-metrics";
import { nutritionGoalPlans } from "@/lib/nutrition/target-plans";
import type { NutritionTargets } from "@/lib/nutrition/types";
import { addBodyMetric, getBodyMetrics } from "@/lib/storage/body-storage";
import {
  getBodyProfile,
  updateBodyProfile,
  type ActivityLevel,
  type BodySex,
} from "@/lib/storage/profile";
import { saveNutritionTargets } from "@/lib/storage/nutrition-storage";
import { cn } from "@/lib/utils";

const TIMEFRAMES = [4, 8, 12, 16, 24, 36, 52] as const;

function parsed(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : undefined;
}

function latestWeight(): number | undefined {
  return [...getBodyMetrics()]
    .reverse()
    .find((entry) => entry.weightKg !== undefined)?.weightKg;
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
  const [fibre, setFibre] = React.useState("");
  const [sodium, setSodium] = React.useState("");
  const [differentTrainingTargets, setDifferentTrainingTargets] = React.useState(false);
  const [trainingCalories, setTrainingCalories] = React.useState("");
  const [trainingProtein, setTrainingProtein] = React.useState("");
  const [trainingCarbs, setTrainingCarbs] = React.useState("");
  const [trainingFat, setTrainingFat] = React.useState("");
  const [weight, setWeight] = React.useState("");
  const [initialWeight, setInitialWeight] = React.useState<number | undefined>();
  const [goalWeight, setGoalWeight] = React.useState("");
  const [height, setHeight] = React.useState("");
  const [birthYear, setBirthYear] = React.useState("");
  const [sex, setSex] = React.useState<BodySex | "">("");
  const [activity, setActivity] = React.useState<ActivityLevel | "">("");
  const [timeframeWeeks, setTimeframeWeeks] = React.useState("12");
  const [selectedPlanId, setSelectedPlanId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const profile = getBodyProfile();
    const currentWeight = latestWeight();
    setCalories(targets ? String(targets.caloriesKcal) : "");
    setProtein(targets ? String(targets.proteinG) : "");
    setCarbs(targets ? String(targets.carbsG) : "");
    setFat(targets ? String(targets.fatG) : "");
    setFibre(targets?.fibreG !== undefined ? String(targets.fibreG) : "");
    setSodium(targets?.sodiumMg !== undefined ? String(targets.sodiumMg) : "");
    setDifferentTrainingTargets(Boolean(targets?.trainingDay));
    setTrainingCalories(targets?.trainingDay ? String(targets.trainingDay.caloriesKcal) : "");
    setTrainingProtein(targets?.trainingDay ? String(targets.trainingDay.proteinG) : "");
    setTrainingCarbs(targets?.trainingDay ? String(targets.trainingDay.carbsG) : "");
    setTrainingFat(targets?.trainingDay ? String(targets.trainingDay.fatG) : "");
    setWeight(currentWeight !== undefined ? String(currentWeight) : "");
    setInitialWeight(currentWeight);
    setGoalWeight(profile.goalWeightKg !== undefined ? String(profile.goalWeightKg) : "");
    setHeight(profile.heightCm !== undefined ? String(profile.heightCm) : "");
    setBirthYear(profile.birthYear !== undefined ? String(profile.birthYear) : "");
    setSex(profile.sex ?? "");
    setActivity(profile.activity ?? "");
    setTimeframeWeeks(
      TIMEFRAMES.includes(profile.goalTimeframeWeeks as (typeof TIMEFRAMES)[number])
        ? String(profile.goalTimeframeWeeks)
        : "12"
    );
    setSelectedPlanId(null);
  }, [open, targets]);

  const plans = React.useMemo(() => {
    const currentWeight = parsed(weight);
    const targetWeight = parsed(goalWeight);
    const heightCm = parsed(height);
    const year = parsed(birthYear);
    const weeks = parsed(timeframeWeeks);
    if (!currentWeight || !targetWeight || !heightCm || !year || !weeks || !sex || !activity) {
      return [];
    }
    const bmr = computeBMR(currentWeight, heightCm, computeAge(year), sex);
    const tdee = computeTDEE(bmr, activity);
    if (!bmr || !tdee) return [];
    return nutritionGoalPlans({
      bmr,
      tdee,
      currentWeightKg: currentWeight,
      goalWeightKg: targetWeight,
      timeframeWeeks: weeks,
    });
  }, [activity, birthYear, goalWeight, height, sex, timeframeWeeks, weight]);

  React.useEffect(() => {
    setSelectedPlanId(null);
  }, [activity, birthYear, goalWeight, height, sex, timeframeWeeks, weight]);

  const applyPlan = (plan: (typeof plans)[number]) => {
    setCalories(String(plan.caloriesKcal));
    setProtein(String(plan.proteinG));
    setCarbs(String(plan.carbsG));
    setFat(String(plan.fatG));
    if (differentTrainingTargets) {
      setTrainingCalories(String(plan.caloriesKcal + 200));
      setTrainingProtein(String(plan.proteinG));
      setTrainingCarbs(String(plan.carbsG + 50));
      setTrainingFat(String(plan.fatG));
    }
    setSelectedPlanId(plan.id);
  };

  const toggleTrainingTargets = () => {
    setDifferentTrainingTargets((current) => {
      const next = !current;
      if (next && !trainingCalories) {
        const baseCalories = parsed(calories) ?? 0;
        const baseCarbs = parsed(carbs) ?? 0;
        setTrainingCalories(baseCalories ? String(Math.round(baseCalories + 200)) : "");
        setTrainingProtein(protein);
        setTrainingCarbs(baseCarbs ? String(Math.round(baseCarbs + 50)) : carbs);
        setTrainingFat(fat);
      }
      return next;
    });
  };

  const save = () => {
    const values = {
      caloriesKcal: Number.parseFloat(calories),
      proteinG: protein.trim() ? Number.parseFloat(protein) : 0,
      carbsG: carbs.trim() ? Number.parseFloat(carbs) : 0,
      fatG: fat.trim() ? Number.parseFloat(fat) : 0,
      fibreG: fibre.trim() ? Number.parseFloat(fibre) : undefined,
      sodiumMg: sodium.trim() ? Number.parseFloat(sodium) : undefined,
      trainingDay: differentTrainingTargets
        ? {
            caloriesKcal: Number.parseFloat(trainingCalories),
            proteinG: trainingProtein.trim() ? Number.parseFloat(trainingProtein) : 0,
            carbsG: trainingCarbs.trim() ? Number.parseFloat(trainingCarbs) : 0,
            fatG: trainingFat.trim() ? Number.parseFloat(trainingFat) : 0,
          }
        : undefined,
    };
    if (!Number.isFinite(values.caloriesKcal) || values.caloriesKcal <= 0) {
      toast.error("Enter a daily calorie target greater than zero.");
      return;
    }
    if ([values.proteinG, values.carbsG, values.fatG].some((value) => !Number.isFinite(value) || value < 0)) {
      toast.error("Macro targets cannot be negative.");
      return;
    }
    if (
      [values.fibreG, values.sodiumMg].some(
        (value) => value !== undefined && (!Number.isFinite(value) || value < 0)
      )
    ) {
      toast.error("Fiber and sodium targets cannot be negative.");
      return;
    }
    if (
      values.trainingDay &&
      (!Number.isFinite(values.trainingDay.caloriesKcal) ||
        values.trainingDay.caloriesKcal <= 0 ||
        [
          values.trainingDay.proteinG,
          values.trainingDay.carbsG,
          values.trainingDay.fatG,
        ].some((value) => !Number.isFinite(value) || value < 0))
    ) {
      toast.error("Enter valid training-day calories and macros.");
      return;
    }

    const currentWeight = parsed(weight);
    const targetWeight = parsed(goalWeight);
    const heightCm = parsed(height);
    const year = parsed(birthYear);
    const weeks = parsed(timeframeWeeks);
    if (weight.trim() && (!currentWeight || currentWeight < 20 || currentWeight > 400)) {
      toast.error("Enter a current weight between 20 and 400 kg.");
      return;
    }
    if (goalWeight.trim() && (!targetWeight || targetWeight < 20 || targetWeight > 400)) {
      toast.error("Enter a goal weight between 20 and 400 kg.");
      return;
    }
    if (height.trim() && (!heightCm || heightCm < 50 || heightCm > 260)) {
      toast.error("Enter a height between 50 and 260 cm.");
      return;
    }
    const currentYear = new Date().getFullYear();
    if (birthYear.trim() && (!year || year < 1900 || year > currentYear)) {
      toast.error(`Enter a birth year between 1900 and ${currentYear}.`);
      return;
    }

    const saved = saveNutritionTargets(values);
    if (!saved) {
      toast.error("Couldn't save your nutrition targets.");
      return;
    }

    updateBodyProfile({
      heightCm,
      birthYear: year,
      sex: sex || undefined,
      activity: activity || undefined,
      goalWeightKg: targetWeight,
      goalTimeframeWeeks: targetWeight && weeks ? weeks : undefined,
    });
    if (
      currentWeight &&
      (initialWeight === undefined || Math.abs(currentWeight - initialWeight) >= 0.05) &&
      !addBodyMetric({ weightKg: currentWeight, note: "Updated from nutrition targets" })
    ) {
      toast.error("Targets were saved, but the current weight could not be added to Body.");
    }

    onSaved(saved);
    onOpenChange(false);
    toast.success("Nutrition targets saved");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100dvh-1rem)] overflow-y-auto sm:max-w-xl"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="text-left">
          <DialogTitle>Nutrition targets</DialogTitle>
          <DialogDescription>
            Add your details, choose an estimated plan, then adjust anything you prefer.
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-4 rounded-xl border bg-muted/20 p-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Scale className="size-4 text-primary" /> Your goal details
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Shared with Body and stored only on this device. A changed current weight creates a new Body weigh-in.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="target-current-weight">Current weight (kg)</Label>
              <NumberInput id="target-current-weight" decimal value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="e.g. 82" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target-goal-weight">Goal weight (kg)</Label>
              <NumberInput id="target-goal-weight" decimal value={goalWeight} onChange={(event) => setGoalWeight(event.target.value)} placeholder="e.g. 75" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target-height">Height (cm)</Label>
              <NumberInput id="target-height" decimal value={height} onChange={(event) => setHeight(event.target.value)} placeholder="e.g. 178" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target-birth-year">Birth year</Label>
              <NumberInput id="target-birth-year" value={birthYear} onChange={(event) => setBirthYear(event.target.value)} placeholder="e.g. 1995" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target-sex">Sex</Label>
              <Select value={sex} onValueChange={(value) => setSex(value as BodySex)}>
                <SelectTrigger id="target-sex" className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target-activity">Activity</Label>
              <Select value={activity} onValueChange={(value) => setActivity(value as ActivityLevel)}>
                <SelectTrigger id="target-activity" className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {ACTIVITY_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value}>{level.label} — {level.hint}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="target-timeframe">Time to reach your goal</Label>
              <Select value={timeframeWeeks} onValueChange={setTimeframeWeeks}>
                <SelectTrigger id="target-timeframe" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEFRAMES.map((weeks) => (
                    <SelectItem key={weeks} value={String(weeks)}>
                      {weeks} weeks{weeks >= 52 ? " (about 1 year)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {plans.length > 0 ? (
          <section className="space-y-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4 text-primary" /> Choose an estimate
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Compare three standard approaches with a plan based on your selected timeframe. Macros are editable starting points.
              </p>
            </div>
            <div className="grid gap-2">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selectedPlanId === plan.id && "border-primary bg-primary/10"
                  )}
                  onClick={() => applyPlan(plan)}
                  aria-pressed={selectedPlanId === plan.id}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block text-sm font-semibold">{plan.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {plan.description}
                        {plan.limited ? " · limited by the supported calorie range" : ""}
                        {!plan.limited && plan.caution ? " · more aggressive than the standard options" : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-base font-bold tabular-nums">{plan.caloriesKcal} kcal</span>
                  </span>
                  <span className="mt-2 block text-xs text-muted-foreground">
                    Protein {plan.proteinG}g · Carbs {plan.carbsG}g · Fat {plan.fatG}g
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <div className="flex gap-2 rounded-xl border border-dashed p-3 text-sm">
            <Calculator className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">Complete your goal details for estimates</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Current and goal weight, height, birth year, sex, and activity are needed.
              </p>
            </div>
          </div>
        )}

        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Default and rest-day targets</h3>
            <p className="mt-1 text-xs text-muted-foreground">Choose an estimate above or enter your own targets.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="nutrition-target-calories">Calories (kcal)</Label>
              <NumberInput id="nutrition-target-calories" value={calories} onChange={(event) => { setCalories(event.target.value); setSelectedPlanId(null); }} placeholder="e.g. 2300" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nutrition-target-protein">Protein (g)</Label>
              <NumberInput id="nutrition-target-protein" decimal value={protein} onChange={(event) => { setProtein(event.target.value); setSelectedPlanId(null); }} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nutrition-target-carbs">Carbs (g)</Label>
              <NumberInput id="nutrition-target-carbs" decimal value={carbs} onChange={(event) => { setCarbs(event.target.value); setSelectedPlanId(null); }} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nutrition-target-fat">Fat (g)</Label>
              <NumberInput id="nutrition-target-fat" decimal value={fat} onChange={(event) => { setFat(event.target.value); setSelectedPlanId(null); }} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nutrition-target-fibre">Fiber (g)</Label>
              <NumberInput id="nutrition-target-fibre" decimal value={fibre} onChange={(event) => setFibre(event.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nutrition-target-sodium">Sodium (mg)</Label>
              <NumberInput id="nutrition-target-sodium" decimal value={sodium} onChange={(event) => setSodium(event.target.value)} placeholder="Optional" />
            </div>
          </div>
        </section>

        <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Dumbbell className="size-4 text-primary" /> Training-day targets
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Automatically used on days containing a completed workout.
              </p>
            </div>
            <Button type="button" size="sm" variant={differentTrainingTargets ? "default" : "outline"} aria-pressed={differentTrainingTargets} onClick={toggleTrainingTargets}>
              {differentTrainingTargets ? "Enabled" : "Enable"}
            </Button>
          </div>
          {differentTrainingTargets && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="training-target-calories">Training calories (kcal)</Label>
                <NumberInput id="training-target-calories" decimal value={trainingCalories} onChange={(event) => setTrainingCalories(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="training-target-protein">Protein (g)</Label>
                <NumberInput id="training-target-protein" decimal value={trainingProtein} onChange={(event) => setTrainingProtein(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="training-target-carbs">Carbs (g)</Label>
                <NumberInput id="training-target-carbs" decimal value={trainingCarbs} onChange={(event) => setTrainingCarbs(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="training-target-fat">Fat (g)</Label>
                <NumberInput id="training-target-fat" decimal value={trainingFat} onChange={(event) => setTrainingFat(event.target.value)} />
              </div>
            </div>
          )}
        </section>

        <p className="text-xs leading-relaxed text-muted-foreground">
          These are planning estimates, not medical advice. Real energy needs vary; monitor your trend and adjust gradually.
        </p>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={save}>Save targets</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
