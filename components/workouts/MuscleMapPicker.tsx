"use client";

import * as React from "react";

import type { Muscle, MuscleMapWidget } from "@abdofallah/musclemap-js";
import type { MuscleTargetKey } from "@/lib/exercises";
import { HEAT_COLOR, TARGET_TO_SDK, SDK_TO_TARGET } from "@/lib/muscle-map";

const SELECTED_OPACITY = 0.85;

/**
 * Interactive body map for picking individual target muscles. Tapping a muscle
 * toggles just that muscle (e.g. triceps, not the whole arm), rendered as a red
 * overlay we fully control. Stays in sync with the muscle chips via the shared
 * `value`. Sub-muscle taps resolve to their parent; the SDK's own selection
 * paint is cleared so only our overlay shows.
 */
export function MuscleMapPicker({
  value,
  onToggle,
  gender = "male",
}: {
  value: MuscleTargetKey[];
  onToggle: (key: MuscleTargetKey) => void;
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

  const applyHighlights = React.useCallback((keys: MuscleTargetKey[]) => {
    const data = keys.flatMap((k) =>
      TARGET_TO_SDK[k].map((muscle) => ({ muscle, color: HEAT_COLOR, opacity: SELECTED_OPACITY }))
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
        const key = SDK_TO_TARGET[base];
        // The SDK paints its own (green) selection overlay from `selectedMuscles`,
        // independent of highlights. Always clear it so no stray green remains,
        // then repaint our red overlay synchronously (React state is async).
        frontMap.current?.clearSelection();
        backMap.current?.clearSelection();
        if (!key) {
          applyHighlights(valueRef.current);
          return;
        }
        const cur = valueRef.current;
        const next = cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key];
        toggleRef.current(key);
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
