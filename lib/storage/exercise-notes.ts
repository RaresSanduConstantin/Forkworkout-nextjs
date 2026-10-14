import { STORAGE_KEYS } from "./keys";
import { readJson, writeJson } from "./safe-storage";

export const MAX_EXERCISE_NOTE_LENGTH = 2000;

export type ExerciseNote = {
  exerciseId: string;
  text: string;
  updatedAt: string;
};

function normalize(raw: unknown): ExerciseNote | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (
    typeof value.exerciseId !== "string" || !value.exerciseId.trim() ||
    typeof value.text !== "string" || value.text.length > MAX_EXERCISE_NOTE_LENGTH ||
    typeof value.updatedAt !== "string" || !Number.isFinite(Date.parse(value.updatedAt))
  ) return null;
  return {
    exerciseId: value.exerciseId.trim(),
    text: value.text.trim(),
    updatedAt: value.updatedAt,
  };
}

function normalizeEntries(entries: unknown[]): ExerciseNote[] {
  const notes = new Map<string, ExerciseNote>();
  for (const raw of entries) {
    const note = normalize(raw);
    if (!note) continue;
    const existing = notes.get(note.exerciseId);
    if (!existing || Date.parse(note.updatedAt) > Date.parse(existing.updatedAt)) {
      notes.set(note.exerciseId, note);
    }
  }
  return [...notes.values()];
}

/** Empty text is retained so importing an older backup cannot revive cleared notes. */
export function getExerciseNotes(): ExerciseNote[] {
  const raw = readJson<unknown>(STORAGE_KEYS.exerciseNotes, null);
  if (!raw || typeof raw !== "object") return [];
  const envelope = raw as Record<string, unknown>;
  if (envelope.version !== 1 || !Array.isArray(envelope.data)) return [];
  return normalizeEntries(envelope.data);
}

export function getExerciseNote(exerciseId: string): string {
  return getExerciseNotes().find((note) => note.exerciseId === exerciseId)?.text ?? "";
}

export function saveExerciseNotes(entries: unknown[]): boolean {
  return writeJson(STORAGE_KEYS.exerciseNotes, {
    version: 1,
    data: normalizeEntries(entries),
  });
}

export function setExerciseNote(exerciseId: string, text: string): ExerciseNote | null {
  const note = normalize({ exerciseId, text, updatedAt: new Date().toISOString() });
  if (!note) return null;
  const notes = getExerciseNotes().filter((entry) => entry.exerciseId !== note.exerciseId);
  return saveExerciseNotes([...notes, note]) ? note : null;
}

export function mergeExerciseNotes(entries: unknown[]): boolean {
  return saveExerciseNotes([...getExerciseNotes(), ...entries]);
}
