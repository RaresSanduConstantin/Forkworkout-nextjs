"use client";

import * as React from "react";
import { User } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ACTIVITY_LEVELS } from "@/lib/body-metrics";
import type { BodyProfile } from "@/lib/storage/profile";

/**
 * Editor for the static body profile (height, sex, birth year, activity) that
 * powers the BMI / BMR / calorie / body-fat calculators. Controlled: emits a
 * partial patch on every change; the parent persists it.
 */
export function BodyProfileCard({
  profile,
  onChange,
}: {
  profile: BodyProfile;
  onChange: (patch: Partial<BodyProfile>) => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <User className="size-4 text-primary" />
          <h2 className="font-semibold">Your profile</h2>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          Used to calculate BMI, BMR, calories and body fat. Stored only on this device.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="bp-height" className="text-sm font-medium">
              Height (cm)
            </label>
            <NumberInput
              id="bp-height"
              decimal
              value={profile.heightCm != null ? String(profile.heightCm) : ""}
              onChange={(e) =>
                onChange({ heightCm: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="e.g. 178"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="bp-year" className="text-sm font-medium">
              Birth year
            </label>
            <NumberInput
              id="bp-year"
              value={profile.birthYear != null ? String(profile.birthYear) : ""}
              onChange={(e) =>
                onChange({ birthYear: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="e.g. 1995"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">Sex</span>
            <Select
              value={profile.sex ?? ""}
              onValueChange={(v) => onChange({ sex: v as BodyProfile["sex"] })}
            >
              <SelectTrigger className="w-full" aria-label="Sex">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">Activity</span>
            <Select
              value={profile.activity ?? ""}
              onValueChange={(v) => onChange({ activity: v as BodyProfile["activity"] })}
            >
              <SelectTrigger className="w-full" aria-label="Activity level">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_LEVELS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label} — {a.hint}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
