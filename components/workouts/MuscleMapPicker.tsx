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

  // When true, the next `value`-effect repaint is skipped because a map tap
  // already painted synchronously (avoids a redundant full canvas redraw).
  const paintedByTap = React.useRef(false);

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
      const clearStraySelection = () => {
        // The SDK paints its own (green) selection from `selectedMuscles`, which
        // in the renderer overrides our highlight — so clear it. Only redraw the
        // widget that actually holds a selection (the tapped one).
        if (frontMap.current?.getSelectedMuscles().length) frontMap.current.clearSelection();
        if (backMap.current?.getSelectedMuscles().length) backMap.current.clearSelection();
      };
      const handleClick = (muscle: Muscle) => {
        const base = getParentGroup(muscle) ?? muscle;
        const key = SDK_TO_TARGET[base];
        if (!key) {
          clearStraySelection();
          return;
        }
        const cur = valueRef.current;
        const next = cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key];
        // Paint immediately for snappy feedback, and skip the value-effect's
        // duplicate repaint that the state update below will trigger.
        paintedByTap.current = true;
        clearStraySelection();
        applyHighlights(next);
        toggleRef.current(key);
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

  // Re-paint when the selection changes from the chips (map taps paint eagerly).
  React.useEffect(() => {
    if (paintedByTap.current) {
      paintedByTap.current = false;
      return;
    }
    if (ready.current) applyHighlights(value);
  }, [value, applyHighlights]);

  return (
    <div className="flex items-end justify-center gap-3 rounded-lg border bg-muted/30 py-3">
      <figure className="flex flex-col items-center gap-1">
        <div ref={frontRef} className="h-72 w-32 cursor-pointer" />
        <figcaption className="text-xs text-muted-foreground">Front</figcaption>
      </figure>
      <figure className="flex flex-col items-center gap-1">
        <div ref={backRef} className="h-72 w-32 cursor-pointer" />
        <figcaption className="text-xs text-muted-foreground">Back</figcaption>
      </figure>
    </div>
  );
}
