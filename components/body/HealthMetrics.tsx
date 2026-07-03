"use client";

import * as React from "react";
import { Activity, Flame, Gauge, Percent } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/shared/StatCard";
import { InfoHint } from "@/components/shared/InfoHint";
import type { BodyProfile } from "@/lib/storage/profile";
import {
  computeBMI,
  bmiCategory,
  computeAge,
  computeBMR,
  computeTDEE,
  calorieTargets,
  bodyFatNavy,
} from "@/lib/body-metrics";

/**
 * Health calculators derived from the profile + the user's latest logged
 * values: BMI (+ category), body fat % (Navy method), BMR, maintenance
 * calories (TDEE), and cut/maintain/bulk calorie targets. Prompts to complete
 * the profile when required inputs are missing.
 */
export function HealthMetrics({
  profile,
  weightKg,
  waist,
  neck,
  hips,
}: {
  profile: BodyProfile;
  weightKg?: number;
  waist?: number;
  neck?: number;
  hips?: number;
}) {
  const bmi = computeBMI(weightKg, profile.heightCm);
  const age = computeAge(profile.birthYear);
  const bmr = computeBMR(weightKg, profile.heightCm, age, profile.sex);
  const tdee = computeTDEE(bmr, profile.activity);
  const targets = calorieTargets(tdee);
  const bodyFat = bodyFatNavy(profile.sex, profile.heightCm, waist, neck, hips);

  const nothing = bmi === null && bmr === null && bodyFat === null;
  if (nothing) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground">
          Add your height, sex, birth year and activity above (and log your weight) to see your
          BMI, BMR, calorie needs and body fat.
        </CardContent>
      </Card>
    );
  }

  const cat = bmi !== null ? bmiCategory(bmi) : null;

  // Tell the user exactly what's missing when body fat can't be computed.
  let bodyFatHint: string | null = null;
  if (bodyFat === null) {
    if (!profile.sex || !profile.heightCm) {
      bodyFatHint = "Add your sex and height above to calculate body fat.";
    } else {
      const need: string[] = [];
      if (!waist) need.push("waist");
      if (!neck) need.push("neck");
      if (profile.sex === "female" && !hips) need.push("hips");
      if (need.length) {
        bodyFatHint = `Log your ${need.join(", ")} measurement${
          need.length > 1 ? "s" : ""
        } to calculate body fat.`;
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label={cat ? `BMI · ${cat.label}` : "BMI"}
          value={
            bmi !== null ? <span className={cat?.tone}>{bmi}</span> : <span className="text-muted-foreground">—</span>
          }
          icon={<Gauge className="size-5" />}
          info={
            <InfoHint title="BMI">
              Body Mass Index — your weight relative to your height. Under 18.5 is underweight,
              18.5–25 healthy, 25–30 overweight, 30+ obese. A rough guide that doesn&apos;t account
              for muscle.
            </InfoHint>
          }
        />
        <StatCard
          label="Body fat (Navy)"
          value={bodyFat !== null ? `${bodyFat}%` : <span className="text-muted-foreground">—</span>}
          icon={<Percent className="size-5" />}
          info={
            <InfoHint title="Body fat %">
              Estimated share of your weight that is fat, using the U.S. Navy tape method from your
              height, neck and waist (plus hips for women). Log those measurements to see it.
            </InfoHint>
          }
        />
        <StatCard
          label="BMR (rest)"
          value={bmr !== null ? `${bmr}` : <span className="text-muted-foreground">—</span>}
          icon={<Activity className="size-5" />}
          info={
            <InfoHint title="BMR">
              Basal Metabolic Rate — the calories your body burns at complete rest in a day, just to
              keep you alive.
            </InfoHint>
          }
        />
        <StatCard
          label="Maintenance kcal"
          value={tdee !== null ? `${tdee}` : <span className="text-muted-foreground">—</span>}
          icon={<Flame className="size-5" />}
          info={
            <InfoHint title="Maintenance calories">
              Calories per day to keep your current weight (BMR × your activity level). Eat below it
              to lose fat, above it to gain.
            </InfoHint>
          }
        />
      </div>

      {bodyFatHint && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Percent className="size-3.5 shrink-0" />
          {bodyFatHint}
        </p>
      )}

      {targets && (
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              Daily calorie targets
              <InfoHint title="Calorie targets">
                Rough daily calorie goals around your maintenance level: about −500 kcal to lose ~0.5
                kg/week, maintenance to stay the same, and +300 kcal to gain muscle.
              </InfoHint>
            </h3>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border p-2.5">
                <div className="text-lg font-bold tabular-nums text-sky-500">{targets.cut}</div>
                <div className="text-xs text-muted-foreground">Lose fat</div>
              </div>
              <div className="rounded-lg border p-2.5">
                <div className="text-lg font-bold tabular-nums text-emerald-500">
                  {targets.maintain}
                </div>
                <div className="text-xs text-muted-foreground">Maintain</div>
              </div>
              <div className="rounded-lg border p-2.5">
                <div className="text-lg font-bold tabular-nums text-amber-500">{targets.bulk}</div>
                <div className="text-xs text-muted-foreground">Gain muscle</div>
              </div>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              Estimates from the Mifflin-St Jeor equation × your activity level. Body fat uses the
              U.S. Navy method. Use as a guide, not medical advice.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
