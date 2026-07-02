"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ArrowLeft, Plus, Scale, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  getBodyMetrics,
  addBodyMetric,
  deleteBodyMetric,
} from "@/lib/storage/body-storage";
import { ROUTES } from "@/lib/routes";
import type { BodyMeasurements, BodyMetricEntry } from "@/lib/types";

const MEASURES: { key: keyof BodyMeasurements; label: string }[] = [
  { key: "chest", label: "Chest" },
  { key: "waist", label: "Waist" },
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

  React.useEffect(() => {
    setEntries(getBodyMetrics());
    setLoaded(true);
  }, []);

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

  const chartConfig = {
    value: { label: "Weight (kg)", color: "var(--chart-1)" },
  } satisfies ChartConfig;

  return (
    <PageContainer>
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
            <Input
              id="bm-weight"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g. 78.5"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">Measurements (cm, optional)</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {MEASURES.map((m) => (
                <Input
                  key={m.key}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.1"
                  value={measures[m.key] ?? ""}
                  onChange={(e) =>
                    setMeasures((prev) => ({ ...prev, [m.key]: e.target.value }))
                  }
                  placeholder={m.label}
                  aria-label={m.label}
                />
              ))}
            </div>
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

          {/* Entries list */}
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
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label="Delete entry"
                    onClick={() => setPendingDelete(entry)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
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
    </PageContainer>
  );
}
