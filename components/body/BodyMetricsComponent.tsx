"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ArrowLeft, Pencil, Plus, Scale, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatCard } from "@/components/shared/StatCard";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { getBodyMetrics, addBodyMetric, deleteBodyMetric } from "@/lib/storage/body-storage";
import { getBodyProfile, updateBodyProfile, type BodyProfile } from "@/lib/storage/profile";
import { computeBMI, bodyFatNavy } from "@/lib/body-metrics";
import { BodyProfileCard } from "@/components/body/BodyProfileCard";
import { HealthMetrics } from "@/components/body/HealthMetrics";
import { WeightGoalCard } from "@/components/body/WeightGoalCard";
import { EditBodyEntryDialog } from "@/components/body/EditBodyEntryDialog";
import { Calendar } from "@/components/ui/calendar";
import { dayKeyToDate } from "@/lib/date/day-key";
import { ROUTES } from "@/lib/routes";
import type { BodyMeasurements, BodyMetricEntry } from "@/lib/types";

const MEASURES: { key: keyof BodyMeasurements; label: string }[] = [
  { key: "chest", label: "Chest" },
  { key: "waist", label: "Waist" },
  { key: "neck", label: "Neck" },
  { key: "arms", label: "Arms" },
  { key: "thighs", label: "Thighs" },
  { key: "hips", label: "Hips" },
];

const parseNum = (s: string): number | undefined => {
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export function BodyMetricsComponent() {
  const [entries, setEntries] = React.useState<BodyMetricEntry[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [weight, setWeight] = React.useState("");
  const [measures, setMeasures] = React.useState<Record<string, string>>({});
  const [note, setNote] = React.useState("");
  const [pendingDelete, setPendingDelete] = React.useState<BodyMetricEntry | null>(null);
  const [editEntry, setEditEntry] = React.useState<BodyMetricEntry | null>(null);
  const [profile, setProfile] = React.useState<BodyProfile>({});
  const [calMonth, setCalMonth] = React.useState<Date>(new Date());

  React.useEffect(() => {
    setEntries(getBodyMetrics());
    setProfile(getBodyProfile());
    setLoaded(true);
  }, []);

  const handleProfileChange = (patch: Partial<BodyProfile>) =>
    setProfile(updateBodyProfile(patch));

  const refresh = () => setEntries(getBodyMetrics());

  const handleAdd = () => {
    const weightKg = parseNum(weight);
    const measurements: BodyMeasurements = {};
    for (const m of MEASURES) {
      const v = parseNum(measures[m.key] ?? "");
      if (v !== undefined) measurements[m.key] = v;
    }
    const hasMeasures = Object.keys(measurements).length > 0;
    if (weightKg === undefined && !hasMeasures) {
      toast.error("Enter your weight or at least one measurement.");
      return;
    }
    const ok = addBodyMetric({
      weightKg,
      measurements: hasMeasures ? measurements : undefined,
      note: note.trim() || undefined,
    });
    if (!ok) {
      toast.error("Couldn't save — storage may be full.");
      return;
    }
    setWeight("");
    setMeasures({});
    setNote("");
    refresh();
    toast.success("Logged 💪");
  };

  const weightSeries = React.useMemo(
    () =>
      entries
        .filter((e) => e.weightKg !== undefined)
        .map((e) => ({ label: format(new Date(e.date), "MMM d"), value: e.weightKg as number })),
    [entries]
  );

  const latestWeight = weightSeries.length ? weightSeries[weightSeries.length - 1].value : null;
  const firstWeight = weightSeries.length ? weightSeries[0].value : null;
  const delta =
    latestWeight !== null && firstWeight !== null
      ? Math.round((latestWeight - firstWeight) * 10) / 10
      : null;

  // Most-recent known value for each field (entries are oldest → newest).
  const latestValues = React.useMemo(() => {
    const v: { weightKg?: number; waist?: number; neck?: number; hips?: number } = {};
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      if (v.weightKg === undefined && e.weightKg !== undefined) v.weightKg = e.weightKg;
      if (v.waist === undefined && e.measurements?.waist !== undefined) v.waist = e.measurements.waist;
      if (v.neck === undefined && e.measurements?.neck !== undefined) v.neck = e.measurements.neck;
      if (v.hips === undefined && e.measurements?.hips !== undefined) v.hips = e.measurements.hips;
    }
    return v;
  }, [entries]);

  const bmiSeries = React.useMemo(() => {
    if (!profile.heightCm) return [] as { label: string; value: number }[];
    return entries
      .filter((e) => e.weightKg !== undefined)
      .map((e) => ({
        label: format(new Date(e.date), "MMM d"),
        value: computeBMI(e.weightKg, profile.heightCm),
      }))
      .filter((p): p is { label: string; value: number } => p.value !== null);
  }, [entries, profile.heightCm]);

  const bodyFatSeries = React.useMemo(() => {
    if (!profile.sex || !profile.heightCm) return [] as { label: string; value: number }[];
    return entries
      .map((e) => {
        const bf = bodyFatNavy(
          profile.sex,
          profile.heightCm,
          e.measurements?.waist,
          e.measurements?.neck,
          e.measurements?.hips
        );
        return bf !== null ? { label: format(new Date(e.date), "MMM d"), value: bf } : null;
      })
      .filter((p): p is { label: string; value: number } => p !== null);
  }, [entries, profile.sex, profile.heightCm]);

  const loggedDates = React.useMemo(
    () => entries.map((e) => (e.dayKey ? dayKeyToDate(e.dayKey) : new Date(e.date))),
    [entries]
  );

  const weightPoints = React.useMemo(
    () =>
      entries
        .filter((e) => e.weightKg !== undefined)
        .map((e) => ({ date: e.date, weightKg: e.weightKg as number })),
    [entries]
  );

  const chartConfig = {
    value: { label: "Weight (kg)", color: "var(--chart-1)" },
  } satisfies ChartConfig;

  const bmiChartConfig = {
    value: { label: "BMI", color: "var(--chart-2)" },
  } satisfies ChartConfig;

  const bodyFatChartConfig = {
    value: { label: "Body fat (%)", color: "var(--chart-4)" },
  } satisfies ChartConfig;

  return (
    <PageContainer className="pb-24">
      <Button asChild variant="ghost" size="sm" className="mb-2 gap-1 px-2">
        <Link href={ROUTES.dashboard}>
          <ArrowLeft className="size-4" />
          Go Back
        </Link>
      </Button>

      <PageHeader
        title="Body metrics"
        description="Log your bodyweight and measurements to track progress over time. Saved on this device."
      />

      {/* Add entry */}
      <Card className="mb-6">
        <CardContent className="space-y-4 p-4">
          <div className="space-y-1.5">
            <label htmlFor="bm-weight" className="text-sm font-medium">
              Bodyweight (kg)
            </label>
            <NumberInput
              id="bm-weight"
              decimal
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g. 78.5"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">Measurements (cm, optional)</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {MEASURES.map((m) => (
                <NumberInput
                  key={m.key}
                  decimal
                  value={measures[m.key] ?? ""}
                  onChange={(e) =>
                    setMeasures((prev) => ({ ...prev, [m.key]: e.target.value }))
                  }
                  placeholder={m.label}
                  aria-label={m.label}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Tip: log your <span className="font-medium">neck</span> and{" "}
              <span className="font-medium">waist</span> (plus hips for women) to unlock body-fat %.
            </p>
          </div>

          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            maxLength={200}
          />

          <Button className="w-full gap-2" onClick={handleAdd}>
            <Plus className="size-4" />
            Log entry
          </Button>
        </CardContent>
      </Card>

      {/* Profile + health calculators */}
      <div className="mb-6 space-y-6">
        <BodyProfileCard profile={profile} onChange={handleProfileChange} />
        <HealthMetrics
          profile={profile}
          weightKg={latestValues.weightKg}
          waist={latestValues.waist}
          neck={latestValues.neck}
          hips={latestValues.hips}
        />
        <WeightGoalCard profile={profile} onChange={handleProfileChange} series={weightPoints} />
      </div>

      {loaded && entries.length === 0 ? (
        <EmptyState
          icon={<Scale className="size-8" />}
          title="No measurements yet"
          description="Log your bodyweight above and your progress will show up here."
        />
      ) : (
        <div className="space-y-6">
          {/* Summary */}
          {latestWeight !== null && (
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Current weight" value={`${latestWeight} kg`} icon={<Scale className="size-5" />} />
              <StatCard
                label="Change"
                value={delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta} kg`}
                icon={
                  (delta ?? 0) < 0 ? (
                    <TrendingDown className="size-5" />
                  ) : (
                    <TrendingUp className="size-5" />
                  )
                }
              />
            </div>
          )}

          {/* Weight trend */}
          {weightSeries.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h2 className="mb-3 font-semibold">Weight trend</h2>
                <ChartContainer config={chartConfig} className="h-[220px] w-full min-w-0">
                  <LineChart accessibilityLayer data={weightSeries} margin={{ left: 4, right: 8, top: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis width={40} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      dataKey="value"
                      type="monotone"
                      stroke="var(--color-value)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* BMI trend */}
          {bmiSeries.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h2 className="mb-3 font-semibold">BMI trend</h2>
                <ChartContainer config={bmiChartConfig} className="h-[220px] w-full min-w-0">
                  <LineChart accessibilityLayer data={bmiSeries} margin={{ left: 4, right: 8, top: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis width={40} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      dataKey="value"
                      type="monotone"
                      stroke="var(--color-value)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* Body fat trend */}
          {bodyFatSeries.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h2 className="mb-3 font-semibold">Body fat trend</h2>
                <ChartContainer config={bodyFatChartConfig} className="h-[220px] w-full min-w-0">
                  <LineChart accessibilityLayer data={bodyFatSeries} margin={{ left: 4, right: 8, top: 8 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis width={40} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      dataKey="value"
                      type="monotone"
                      stroke="var(--color-value)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* Logged-days calendar */}
          {loggedDates.length > 0 && (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 p-4">
                <div className="w-full">
                  <h2 className="text-xl font-semibold">Logging calendar</h2>
                  <p className="text-sm text-muted-foreground">Every day you log a measurement lights up.</p>
                </div>
                <Calendar
                  mode="single"
                  month={calMonth}
                  onMonthChange={setCalMonth}
                  weekStartsOn={1}
                  showOutsideDays
                  className="rounded-xl border p-3"
                  modifiers={{ logged: loggedDates }}
                  modifiersClassNames={{
                    logged:
                      "rounded-md bg-gradient-to-br from-sky-500 to-emerald-500 font-semibold text-white hover:opacity-90 aria-selected:opacity-100",
                  }}
                />
                <div className="flex w-full items-center gap-2 text-sm text-muted-foreground">
                  <span className="size-3 rounded-sm bg-gradient-to-br from-sky-500 to-emerald-500" />
                  Logged a measurement
                </div>
              </CardContent>
            </Card>
          )}
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground">Log</h2>
            {[...entries].reverse().map((entry) => (
              <Card key={entry.id}>
                <CardContent className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0 space-y-1">
                    <div className="text-sm font-medium">
                      {format(new Date(entry.date), "EEE, MMM d, yyyy")}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                      {entry.weightKg !== undefined && (
                        <span className="font-medium text-foreground">{entry.weightKg} kg</span>
                      )}
                      {entry.measurements &&
                        MEASURES.filter((m) => entry.measurements?.[m.key] !== undefined).map((m) => (
                          <span key={m.key}>
                            {m.label} {entry.measurements?.[m.key]}cm
                          </span>
                        ))}
                    </div>
                    {entry.note && (
                      <p className="text-xs italic text-muted-foreground">“{entry.note}”</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Edit entry"
                      onClick={() => setEditEntry(entry)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Delete entry"
                      onClick={() => setPendingDelete(entry)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this entry?"
        description="This removes the body-metric entry from this device. It cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Keep"
        onConfirm={() => {
          if (pendingDelete) {
            deleteBodyMetric(pendingDelete.id);
            setPendingDelete(null);
            refresh();
          }
        }}
      />

      <EditBodyEntryDialog
        entry={editEntry}
        measures={MEASURES}
        onOpenChange={(open) => !open && setEditEntry(null)}
        onSaved={refresh}
      />
    </PageContainer>
  );
}
