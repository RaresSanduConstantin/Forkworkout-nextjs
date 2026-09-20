/** @vitest-environment jsdom */

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Workout } from "@/lib/types";

vi.mock("@/components/ui/dialog", async () => {
  const ReactModule = await import("react");
  const OpenContext = ReactModule.createContext(false);

  function Dialog({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
  }) {
    return ReactModule.createElement(OpenContext.Provider, { value: open }, children);
  }

  function DialogContent({
    children,
    ...props
  }: React.HTMLAttributes<HTMLDivElement>) {
    const open = ReactModule.useContext(OpenContext);
    const [mounted, setMounted] = ReactModule.useState(false);

    ReactModule.useEffect(() => {
      if (!open) {
        setMounted(false);
        return;
      }

      let active = true;
      queueMicrotask(() => {
        if (active) setMounted(true);
      });
      return () => {
        active = false;
      };
    }, [open]);

    return mounted ? ReactModule.createElement("div", props, children) : null;
  }

  const element = (tag: "div" | "footer" | "h2" | "p") =>
    ({ children, ...props }: React.HTMLAttributes<HTMLElement>) =>
      ReactModule.createElement(tag, props, children);

  return {
    Dialog,
    DialogContent,
    DialogDescription: element("p"),
    DialogFooter: element("footer"),
    DialogHeader: element("div"),
    DialogTitle: element("h2"),
  };
});

vi.mock("@/components/exercises/ExerciseInfoDialog", () => ({
  ExerciseInfoDialog: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) =>
    open
      ? React.createElement(
          "button",
          { "data-testid": "close-info", onClick: () => onOpenChange(false) },
          "Close info"
        )
      : null,
}));

vi.mock("@/components/ui/accordion", () => ({
  Accordion: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  AccordionContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  AccordionItem: ({ children }: { children: React.ReactNode }) =>
    React.createElement("div", null, children),
  AccordionTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement("button", null, children),
}));

vi.mock("@/components/history/MuscleMapView", () => ({
  MuscleMapView: () => React.createElement("div"),
}));

vi.mock("@/lib/exercises", () => ({
  getCachedLibrary: () => [],
  loadExerciseLibrary: async () => [],
}));

vi.mock("@/lib/muscle-map", () => ({
  muscleHighlights: () => [],
  muscleScores: () => [],
}));

vi.mock("@/lib/use-body-gender", () => ({
  useMannequinGender: () => "male",
}));

import { WorkoutPreviewDialog } from "@/components/workouts/WorkoutPreviewDialog";

const workout: Workout = {
  id: "workout-1",
  title: "Full body",
  exercises: [
    { id: "exercise-1", name: "Squat", sets: [{ reps: 8, value: "60", unit: "kg" }] },
    { id: "exercise-2", name: "Press", sets: [{ reps: 8, value: "30", unit: "kg" }] },
  ],
};

describe("WorkoutPreviewDialog scroll restoration", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("restores the preview offset when its portaled content remounts after Info closes", async () => {
    await act(async () => {
      root.render(
        React.createElement(WorkoutPreviewDialog, {
          open: true,
          workout,
          onOpenChange: vi.fn(),
          onStart: vi.fn(),
        })
      );
      await Promise.resolve();
    });

    const scrollArea = container.querySelector<HTMLDivElement>(".overflow-y-auto");
    expect(scrollArea).not.toBeNull();
    scrollArea!.scrollTop = 420;

    const infoButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="View information for Press"]'
    );
    expect(infoButton).not.toBeNull();
    act(() => infoButton!.click());

    const closeInfoButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="close-info"]'
    );
    expect(closeInfoButton).not.toBeNull();

    await act(async () => {
      closeInfoButton!.click();
      await Promise.resolve();
    });

    const restoredScrollArea = container.querySelector<HTMLDivElement>(".overflow-y-auto");
    expect(restoredScrollArea).not.toBe(scrollArea);
    expect(restoredScrollArea?.scrollTop).toBe(420);
  });
});
