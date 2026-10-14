// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExerciseNotesDialog } from "@/components/exercises/ExerciseNotesDialog";
import { getExerciseNote, setExerciseNote } from "@/lib/storage/exercise-notes";
import { runtimeStorageCache } from "@/lib/storage/runtime-cache";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { toast } from "sonner";

let root: Root;
let container: HTMLDivElement;
const onSaved = vi.fn();

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  runtimeStorageCache.reset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  vi.clearAllMocks();
});
afterEach(async () => {
  act(() => root.unmount());
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  container.remove();
  vi.restoreAllMocks();
});

async function render(exerciseId = "leg", exerciseName = "Leg Press") {
  await act(async () => {
    root.render(React.createElement(ExerciseNotesDialog, {
      key: exerciseId, exerciseId, exerciseName,
      hasNote: Boolean(getExerciseNote(exerciseId)), onSaved,
    }));
  });
}

async function click(label: string) {
  const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (element) => element.textContent?.trim() === label
  );
  expect(button, `Button: ${label}`).toBeDefined();
  await act(async () => button!.click());
  // Radix restores focus on the next task after unmounting a dialog.
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

function edit(text: string) {
  const textarea = document.querySelector("textarea")!;
  const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  act(() => {
    setValue.call(textarea, text);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  return textarea;
}

describe("exercise Notes modal", () => {
  it("opens saved settings without activating the mobile keyboard, saves and reloads edits", async () => {
    setExerciseNote("leg", "Seat: 4");
    await render();
    expect(container.querySelector("button")?.getAttribute("aria-label")).toBe("Notes for Leg Press (saved)");
    expect(document.querySelector("textarea")).toBeNull();
    await click("Notes");
    expect(document.querySelector("[role=dialog]")).not.toBeNull();
    expect(document.querySelector("textarea")?.value).toBe("Seat: 4");
    expect(document.activeElement?.tagName).not.toBe("TEXTAREA");
    expect(document.activeElement?.textContent).toBe("Exercise notes");
    edit("Seat: 5\nBackrest: 2");
    await click("Save notes");
    expect(getExerciseNote("leg")).toBe("Seat: 5\nBackrest: 2");
    expect(onSaved).toHaveBeenCalledOnce();
    expect(document.querySelector("[role=dialog]")).toBeNull();
    await click("Notes");
    expect(document.querySelector("textarea")?.value).toBe("Seat: 5\nBackrest: 2");
  });

  it("discards cancelled edits and keeps another exercise's notes separate", async () => {
    setExerciseNote("leg", "Seat: 4");
    await render();
    await click("Notes");
    edit("Unsaved change");
    await click("Cancel");
    await click("Notes");
    expect(document.querySelector("textarea")?.value).toBe("Seat: 4");
    expect(onSaved).not.toHaveBeenCalled();
    await click("Cancel");
    await render("chest", "Chest Press");
    await click("Notes");
    expect(document.querySelector("textarea")?.value).toBe("");
    expect(document.querySelector("[role=dialog]")?.textContent).toContain("Chest Press");
  });

  it("clears saved notes by saving an empty field", async () => {
    setExerciseNote("leg", "Seat: 4");
    await render();
    await click("Notes");
    edit("");
    await click("Save notes");
    expect(getExerciseNote("leg")).toBe("");
    expect(toast.success).toHaveBeenCalledWith("Exercise notes cleared");
  });

  it("dismisses with Escape without saving and returns focus to Notes", async () => {
    setExerciseNote("leg", "Seat: 4");
    await render();
    const trigger = container.querySelector("button")!;
    trigger.focus();
    await click("Notes");
    edit("Unsaved change");
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(document.querySelector("[role=dialog]")).toBeNull();
    expect(getExerciseNote("leg")).toBe("Seat: 4");
    expect(document.activeElement).toBe(trigger);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("keeps the draft open and shows an error when persistence fails", async () => {
    await render();
    await click("Notes");
    edit("Seat: 4");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Quota exceeded"); });
    await click("Save notes");
    expect(document.querySelector("textarea")?.value).toBe("Seat: 4");
    expect(document.querySelector("[role=dialog]")).not.toBeNull();
    expect(toast.error).toHaveBeenCalledOnce();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
