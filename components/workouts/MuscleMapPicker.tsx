"use client";

import * as React from "react";

import type { Muscle, MuscleMapWidget } from "@abdofallah/musclemap-js";
import { MUSCLE_GROUPS, type MuscleGroup } from "@/lib/exercises";
import { HEAT_COLOR } from "@/lib/muscle-map";

// Coarse muscle group -> the SDK base-muscle slugs it covers (used to paint a
// whole region when its group is selected).
const GROUP_TO_SDK: Record<MuscleGroup, Muscle[]> = {
  Chest: ["chest"],
  Back: ["upper-back", "lower-back", "trapezius", "rhomboids"],
  Legs: ["quadriceps", "hamstring", "gluteal", "calves", "tibialis"],
  Shoulders: ["deltoids", "rotator-cuff"],
  Arms: ["biceps", "triceps", "forearm"],
  Core: ["abs", "obliques", "serratus"],
};

// SDK base-muscle slug -> coarse group (inverse of GROUP_TO_SDK).
const SDK_TO_GROUP: Partial<Record<string, MuscleGroup>> = {};
for (const g of MUSCLE_GROUPS) {
  for (const slug of GROUP_TO_SDK[g]) SDK_TO_GROUP[slug] = g;
}

const SELECTED_OPACITY = 0.85;

/**
 * Interactive body map for picking target muscle groups. Tapping any muscle
 * toggles its whole coarse group; the selection is rendered as a red overlay we
 * fully control (the SDK's own single-muscle selection is overwritten each
 * render). Stays in sync with the chip toggles via the shared `value`.
 */
export function MuscleMapPicker({
  value,
  onToggle,
  gender = "male",
}: {
  value: MuscleGroup[];
  onToggle: (group: MuscleGroup) => void;
  gender?: "male" | "female";
}) {
  const frontRef = React.useRef<HTMLDivElement>(null);
  const backRef = React.useRef<HTMLDivElement>(null);
  const frontMap = React.useRef<MuscleMapWidget | null>(null);
  const backMap = React.useRef<MuscleMapWidget | null>(null);
  const ready = React.useRef(false);

  // Always call the latest handler without rebinding the widget listener.
  const toggleRef = React.useRef(onToggle);
  toggleRef.current = onToggle;
  const valueRef = React.useRef(value);
  valueRef.current = value;

  const applyHighlights = React.useCallback((groups: MuscleGroup[]) => {
    const data = groups.flatMap((g) =>
      GROUP_TO_SDK[g].map((muscle) => ({ muscle, color: HEAT_COLOR, opacity: SELECTED_OPACITY }))
    );
    frontMap.current?.setHighlightData(data);
    backMap.current?.setHighlightData(data);
  }, []);

  React.useEffect(() => {
    let mounted = true;
    let cleanup = () => {};
    import("@abdofallah/musclemap-js").then(({ MuscleMapWidget: Widget, getParentGroup }) => {
      if (!mounted || !frontRef.current || !backRef.current) return;
      const handleClick = (muscle: Muscle) => {
        const base = getParentGroup(muscle) ?? muscle;
        const group = SDK_TO_GROUP[base];
        if (!group) return;
        const cur = valueRef.current;
        const next = cur.includes(group) ? cur.filter((x) => x !== group) : [...cur, group];
        toggleRef.current(group);
        // The SDK paints its own (green) selection overlay from `selectedMuscles`,
        // independent of highlights. Clear it so only our red overlay shows, then
        // repaint synchronously (React state updates async and would flash first).
        frontMap.current?.clearSelection();
        backMap.current?.clearSelection();
        applyHighlights(next);
      };
      const opts = {
        gender,
        interactive: true,
        multiSelect: true,
        onMuscleClick: handleClick,
      } as const;
      frontMap.current = new Widget(frontRef.current, { side: "front", ...opts });
      backMap.current = new Widget(backRef.current, { side: "back", ...opts });
      ready.current = true;
      applyHighlights(valueRef.current);
      cleanup = () => {
        frontMap.current?.destroy();
        backMap.current?.destroy();
        frontMap.current = null;
        backMap.current = null;
        ready.current = false;
      };
    });
    return () => {
      mounted = false;
      cleanup();
    };
    // gender re-creates the widgets; handlers read latest state via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gender]);

  // Re-paint whenever the selected groups change (from map taps or chips).
  React.useEffect(() => {
    if (ready.current) applyHighlights(value);
  }, [value, applyHighlights]);

  return (
    <div className="flex items-end justify-center gap-4 rounded-lg border bg-muted/30 py-2">
      <figure className="flex flex-col items-center gap-1">
        <div ref={frontRef} className="h-52 w-24 cursor-pointer" />
        <figcaption className="text-xs text-muted-foreground">Front</figcaption>
      </figure>
      <figure className="flex flex-col items-center gap-1">
        <div ref={backRef} className="h-52 w-24 cursor-pointer" />
        <figcaption className="text-xs text-muted-foreground">Back</figcaption>
      </figure>
    </div>
  );
}
