"use client";

import * as React from "react";
import { Activity, Flame, Gauge, Percent } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/shared/StatCard";
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label={cat ? `BMI · ${cat.label}` : "BMI"}
          value={
            bmi !== null ? <span className={cat?.tone}>{bmi}</span> : <span className="text-muted-foreground">—</span>
          }
          icon={<Gauge className="size-5" />}
        />
        <StatCard
          label="Body fat (Navy)"
          value={bodyFat !== null ? `${bodyFat}%` : <span className="text-muted-foreground">—</span>}
          icon={<Percent className="size-5" />}
        />
        <StatCard
          label="BMR (rest)"
          value={bmr !== null ? `${bmr}` : <span className="text-muted-foreground">—</span>}
          icon={<Activity className="size-5" />}
        />
        <StatCard
          label="Maintenance kcal"
          value={tdee !== null ? `${tdee}` : <span className="text-muted-foreground">—</span>}
          icon={<Flame className="size-5" />}
        />
      </div>

      {targets && (
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              Daily calorie targets
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
