"use client";

import * as React from "react";

import type { MuscleGroup } from "@/lib/exercises";
import type { MuscleMapWidget, Muscle, MuscleIntensity } from "@abdofallah/musclemap-js";

/** Our 6 coarse groups → the SDK's individual muscle slugs. */
const GROUP_MUSCLES: Record<MuscleGroup, Muscle[]> = {
  Chest: ["chest", "serratus"],
  Back: ["upper-back", "lower-back", "trapezius", "rhomboids"],
  Shoulders: ["deltoids", "rotator-cuff"],
  Arms: ["biceps", "triceps", "forearm"],
  Legs: ["quadriceps", "hamstring", "gluteal", "calves", "tibialis"],
  Core: ["abs", "obliques"],
};

const HEATMAP_CFG = { colorScale: "workout" as const, threshold: 0.001 };

function toMuscleIntensities(intensity: Record<MuscleGroup, number>): MuscleIntensity[] {
  const out: MuscleIntensity[] = [];
  for (const group of Object.keys(GROUP_MUSCLES) as MuscleGroup[]) {
    const v = intensity[group] ?? 0;
    if (v <= 0) continue;
    for (const m of GROUP_MUSCLES[group]) out.push({ muscle: m, intensity: v });
  }
  return out;
}

/**
 * Renders the MuscleMapJS front + back body maps, shaded by per-group training
 * intensity (0–1). Instantiated client-side on canvas; cleaned up on unmount.
 */
export function MuscleMapView({
  intensity,
  gender = "male",
}: {
  intensity: Record<MuscleGroup, number>;
  gender?: "male" | "female";
}) {
  const frontRef = React.useRef<HTMLDivElement>(null);
  const backRef = React.useRef<HTMLDivElement>(null);
  const frontMap = React.useRef<MuscleMapWidget | null>(null);
  const backMap = React.useRef<MuscleMapWidget | null>(null);
  const intensityRef = React.useRef(intensity);
  intensityRef.current = intensity;

  React.useEffect(() => {
    let mounted = true;
    let cleanup = () => {};
    import("@abdofallah/musclemap-js").then(({ MuscleMapWidget: Widget }) => {
      if (!mounted || !frontRef.current || !backRef.current) return;
      frontMap.current = new Widget(frontRef.current, {
        side: "front",
        gender,
        interactive: false,
        multiSelect: false,
      });
      backMap.current = new Widget(backRef.current, {
        side: "back",
        gender,
        interactive: false,
        multiSelect: false,
      });
      const data = toMuscleIntensities(intensityRef.current);
      frontMap.current.setHeatmap(data, HEATMAP_CFG);
      backMap.current.setHeatmap(data, HEATMAP_CFG);
      cleanup = () => {
        frontMap.current?.destroy();
        backMap.current?.destroy();
        frontMap.current = null;
        backMap.current = null;
      };
    });
    return () => {
      mounted = false;
      cleanup();
    };
  }, [gender]);

  // Re-shade when intensities change (e.g. a set is completed live).
  React.useEffect(() => {
    const data = toMuscleIntensities(intensity);
    frontMap.current?.setHeatmap(data, HEATMAP_CFG);
    backMap.current?.setHeatmap(data, HEATMAP_CFG);
  }, [intensity]);

  return (
    <div className="flex items-end justify-center gap-4">
      <figure className="flex flex-col items-center gap-1">
        <div ref={frontRef} className="h-56 w-28" />
        <figcaption className="text-xs text-muted-foreground">Front</figcaption>
      </figure>
      <figure className="flex flex-col items-center gap-1">
        <div ref={backRef} className="h-56 w-28" />
        <figcaption className="text-xs text-muted-foreground">Back</figcaption>
      </figure>
    </div>
  );
}
