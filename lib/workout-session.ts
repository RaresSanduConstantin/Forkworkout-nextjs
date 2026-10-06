import type { SessionExercise } from "@/lib/types";

function supersetKey(value: string | undefined): string | null {
  const key = value?.trim();
  return key || null;
}

/**
 * Keeps every multi-exercise superset together at the position of its first
 * member while preserving the relative order of all exercises.
 */
export function arrangeSupersetExercises<T extends { superset?: string }>(
  exercises: readonly T[]
): T[] {
  const membersByGroup = new Map<string, T[]>();
  for (const exercise of exercises) {
    const group = supersetKey(exercise.superset);
    if (!group) continue;
    const members = membersByGroup.get(group) ?? [];
    members.push(exercise);
    membersByGroup.set(group, members);
  }

  const emittedGroups = new Set<string>();
  const arranged: T[] = [];
  for (const exercise of exercises) {
    const group = supersetKey(exercise.superset);
    const members = group ? membersByGroup.get(group) : undefined;
    if (!group || !members || members.length < 2) {
      arranged.push(exercise);
      continue;
    }
    if (emittedGroups.has(group)) continue;
    arranged.push(...members);
    emittedGroups.add(group);
  }
  return arranged;
}

export type SessionSetTarget = {
  exerciseIndex: number;
  setIndex: number;
};

/** Canonical live-session order: normal exercises set-by-set, supersets round-by-round. */
export function getSessionSetSequence(
  exercises: readonly Pick<SessionExercise, "superset" | "sets">[]
): SessionSetTarget[] {
  const sequence: SessionSetTarget[] = [];
  const handledGroups = new Set<string>();

  exercises.forEach((exercise, exerciseIndex) => {
    const group = supersetKey(exercise.superset);
    const memberIndexes = group
      ? exercises.flatMap((candidate, candidateIndex) =>
          supersetKey(candidate.superset) === group ? [candidateIndex] : []
        )
      : [];

    if (!group || memberIndexes.length < 2) {
      exercise.sets.forEach((_set, setIndex) => {
        sequence.push({ exerciseIndex, setIndex });
      });
      return;
    }
    if (handledGroups.has(group)) return;
    handledGroups.add(group);

    const roundCount = Math.max(...memberIndexes.map((index) => exercises[index].sets.length));
    for (let setIndex = 0; setIndex < roundCount; setIndex += 1) {
      for (const memberIndex of memberIndexes) {
        if (exercises[memberIndex].sets[setIndex]) {
          sequence.push({ exerciseIndex: memberIndex, setIndex });
        }
      }
    }
  });

  return sequence;
}

/** Returns the earliest pending target after treating the just-tapped set as done. */
export function getNextPendingSessionSet(
  exercises: readonly Pick<SessionExercise, "superset" | "sets">[],
  completed: SessionSetTarget
): SessionSetTarget | null {
  const sequence = getSessionSetSequence(exercises);
  const currentGroup = supersetKey(exercises[completed.exerciseIndex]?.superset);
  const groupMemberCount = currentGroup
    ? exercises.filter((exercise) => supersetKey(exercise.superset) === currentGroup).length
    : 0;
  const sameBlock = (target: SessionSetTarget) =>
    groupMemberCount > 1
      ? supersetKey(exercises[target.exerciseIndex]?.superset) === currentGroup
      : target.exerciseIndex === completed.exerciseIndex;
  const isPending = (target: SessionSetTarget) =>
    !(
      target.exerciseIndex === completed.exerciseIndex &&
      target.setIndex === completed.setIndex
    ) && exercises[target.exerciseIndex]?.sets[target.setIndex]?.status === "pending";

  // Stay in the manually selected exercise/superset until that active block is
  // complete, even when an earlier exercise still has pending work.
  const pendingInBlock = sequence.find(
    (target) => sameBlock(target) && isPending(target)
  );
  if (pendingInBlock) return pendingInBlock;

  let blockEnd = -1;
  sequence.forEach((target, index) => {
    if (sameBlock(target)) blockEnd = index;
  });
  return (
    sequence.slice(blockEnd + 1).find(isPending) ??
    sequence.slice(0, blockEnd + 1).find(isPending) ??
    null
  );
}

/** True while moving directly to another exercise in the same superset round. */
export function isSameSupersetRound(
  exercises: readonly Pick<SessionExercise, "superset" | "sets">[],
  current: SessionSetTarget,
  next: SessionSetTarget | null
): boolean {
  if (!next || current.setIndex !== next.setIndex) return false;
  const currentGroup = supersetKey(exercises[current.exerciseIndex]?.superset);
  if (!currentGroup) return false;
  const memberCount = exercises.filter(
    (exercise) => supersetKey(exercise.superset) === currentGroup
  ).length;
  return (
    memberCount > 1 &&
    supersetKey(exercises[next.exerciseIndex]?.superset) === currentGroup
  );
}
