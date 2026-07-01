"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { format } from "date-fns";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { CompletedWorkout } from "@/lib/types";

const chartConfig = {
  volume: { label: "Volume (kg)", color: "var(--chart-1)" },
} satisfies ChartConfig;

/**
 * Bar chart of total weight lifted (kg) per completed workout over time.
 * Renders nothing until at least one weighted session exists.
 */
export function VolumeChart({ entries }: { entries: CompletedWorkout[] }) {
  const data = React.useMemo(
    () =>
      entries
        .filter((e) => (e.volume ?? 0) > 0)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-12)
        .map((e) => ({
          label: format(new Date(e.date), "MMM d"),
          volume: e.volume as number,
          title: e.title,
        })),
    [entries]
  );

  if (data.length === 0) return null;

  const total = data.reduce((sum, d) => sum + d.volume, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lifting volume</CardTitle>
        <CardDescription>
          Total weight lifted per workout · {total.toLocaleString()} kg across{" "}
          {data.length} {data.length === 1 ? "session" : "sessions"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[220px] w-full">
          <BarChart accessibilityLayer data={data} margin={{ left: 4, right: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis width={44} tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="volume" fill="var(--color-volume)" radius={6} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
