// Excel (.xlsx) export for viewing/analysis — NOT a restore format (JSON is the
// backup). Builds a multi-tab workbook from local data. exceljs is imported
// dynamically so it never weighs down the main bundle.

import { format } from "date-fns";
import { getWorkouts } from "./workout-storage";
import { getCompletedWorkouts } from "./history-storage";
import { getBodyMetrics } from "./body-storage";
import { getCustomExercises } from "./custom-exercises";
import { SET_UNITS } from "@/lib/workout";
import type { SetUnit } from "@/lib/types";

const unitLabel = (u?: SetUnit) => (u ? SET_UNITS.find((s) => s.value === u)?.label ?? u : "");

/** Builds and downloads a multi-tab .xlsx snapshot of the user's data. */
export async function downloadExcel(): Promise<void> {
  if (typeof window === "undefined") return;
  const mod = await import("exceljs");
  const ExcelJS = mod.default ?? mod;
  const wb = new ExcelJS.Workbook();
  wb.creator = "ForkWorkout";
  wb.created = new Date();

  // --- Workouts (templates) — one row per set ---
  const wsW = wb.addWorksheet("Workouts");
  wsW.columns = [
    { header: "Workout", key: "workout", width: 24 },
    { header: "Exercise", key: "exercise", width: 30 },
    { header: "Superset", key: "superset", width: 10 },
    { header: "Rest (s)", key: "rest", width: 9 },
    { header: "Set", key: "set", width: 6 },
    { header: "Reps", key: "reps", width: 7 },
    { header: "Value", key: "value", width: 10 },
    { header: "Unit", key: "unit", width: 8 },
    { header: "Type", key: "type", width: 10 },
  ];
  for (const w of getWorkouts()) {
    for (const ex of w.exercises) {
      ex.sets.forEach((s, i) => {
        wsW.addRow({
          workout: w.title,
          exercise: ex.name,
          superset: ex.superset ?? "",
          rest: ex.rest ?? "",
          set: i + 1,
          reps: s.reps,
          value: s.value,
          unit: unitLabel(s.unit),
          type: s.type ?? "working",
        });
      });
    }
  }

  const history = getCompletedWorkouts();

  // --- History (per completed workout) --- ("History" is a reserved xlsx name)
  const wsH = wb.addWorksheet("Workout history");
  wsH.columns = [
    { header: "Date", key: "date", width: 20 },
    { header: "Workout", key: "title", width: 24 },
    { header: "Duration (min)", key: "min", width: 14 },
    { header: "Volume (kg)", key: "vol", width: 12 },
    { header: "Total reps", key: "reps", width: 10 },
    { header: "RPE", key: "rpe", width: 6 },
    { header: "Calories", key: "cal", width: 10 },
    { header: "Avg BPM", key: "avg", width: 9 },
    { header: "Max BPM", key: "max", width: 9 },
    { header: "Notes", key: "notes", width: 40 },
  ];
  for (const c of history) {
    wsH.addRow({
      date: format(new Date(c.date), "yyyy-MM-dd HH:mm"),
      title: c.title,
      min: c.durationSec ? Math.round(c.durationSec / 60) : "",
      vol: c.volume ?? "",
      reps: c.totalReps ?? "",
      rpe: c.rpe ?? "",
      cal: c.calories ?? "",
      avg: c.avgHeartRate ?? "",
      max: c.maxHeartRate ?? "",
      notes: c.notes ?? "",
    });
  }

  // --- History sets (per set performed) ---
  const wsHS = wb.addWorksheet("Set log");
  wsHS.columns = [
    { header: "Date", key: "date", width: 20 },
    { header: "Workout", key: "workout", width: 24 },
    { header: "Exercise", key: "exercise", width: 30 },
    { header: "Set", key: "set", width: 6 },
    { header: "Reps", key: "reps", width: 7 },
    { header: "Value", key: "value", width: 10 },
    { header: "Unit", key: "unit", width: 8 },
    { header: "Type", key: "type", width: 10 },
    { header: "Status", key: "status", width: 10 },
  ];
  for (const c of history) {
    const date = format(new Date(c.date), "yyyy-MM-dd HH:mm");
    for (const ex of c.exercises ?? []) {
      ex.sets.forEach((s, i) => {
        wsHS.addRow({
          date,
          workout: c.title,
          exercise: ex.name,
          set: i + 1,
          reps: s.reps,
          value: s.value,
          unit: unitLabel(s.unit),
          type: s.type ?? "working",
          status: s.status,
        });
      });
    }
  }

  // --- Body metrics ---
  const wsB = wb.addWorksheet("Body metrics");
  wsB.columns = [
    { header: "Date", key: "date", width: 20 },
    { header: "Weight (kg)", key: "weight", width: 12 },
    { header: "Chest (cm)", key: "chest", width: 11 },
    { header: "Waist (cm)", key: "waist", width: 11 },
    { header: "Neck (cm)", key: "neck", width: 10 },
    { header: "Arms (cm)", key: "arms", width: 10 },
    { header: "Thighs (cm)", key: "thighs", width: 11 },
    { header: "Hips (cm)", key: "hips", width: 10 },
    { header: "Note", key: "note", width: 30 },
  ];
  for (const b of getBodyMetrics()) {
    wsB.addRow({
      date: format(new Date(b.date), "yyyy-MM-dd HH:mm"),
      weight: b.weightKg ?? "",
      chest: b.measurements?.chest ?? "",
      waist: b.measurements?.waist ?? "",
      neck: b.measurements?.neck ?? "",
      arms: b.measurements?.arms ?? "",
      thighs: b.measurements?.thighs ?? "",
      hips: b.measurements?.hips ?? "",
      note: b.note ?? "",
    });
  }

  // --- Custom exercises ---
  const wsC = wb.addWorksheet("Custom exercises");
  wsC.columns = [
    { header: "Name", key: "name", width: 28 },
    { header: "Unit", key: "unit", width: 10 },
    { header: "Category", key: "category", width: 14 },
    { header: "Equipment", key: "equipment", width: 14 },
    { header: "Primary muscles", key: "muscles", width: 22 },
    { header: "Secondary muscles", key: "secondary", width: 22 },
    { header: "Video URL", key: "video", width: 40 },
    { header: "Instructions", key: "instructions", width: 60 },
  ];
  for (const e of getCustomExercises()) {
    wsC.addRow({
      name: e.name,
      unit: unitLabel(e.defaultUnit),
      category: e.category,
      equipment: e.equipment ?? "",
      muscles: e.primaryMuscles.join(", "),
      secondary: e.secondaryMuscles.join(", "),
      video: e.videoUrl ?? "",
      instructions: e.instructions.join(" | "),
    });
  }

  // Style: bold header + frozen first row on every sheet.
  wb.eachSheet((ws) => {
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `forkworkout-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
