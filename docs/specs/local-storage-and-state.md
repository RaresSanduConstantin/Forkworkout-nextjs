# Local Persistence and State Specification

ForkWorkout is local-first. IndexedDB is the authoritative browser database,
with LocalStorage retained as a compatibility fallback and crash-recovery
journal. Existing stable LocalStorage keys remain supported.

This file defines how agents should approach persistence during the revamp.

## Persistence Principles

- No account is required.
- No backend is required.
- IndexedDB is primary after storage initialization.
- LocalStorage remains readable, writable, and backwards compatible.
- A synchronous runtime cache serves existing storage APIs after hydration.
- Workouts and history should persist across refreshes.
- Existing user data must not be broken.
- Corrupted data must not crash the app.
- Storage reads must be safe for Next.js rendering.

## Runtime architecture

```txt
StorageBoot / StorageGate
        ↓
storage-engine.ts chooses and reconciles the source
        ↓
runtime-cache.ts provides synchronous reads
        ↓
safe-storage.ts writes IndexedDB + LocalStorage compatibility data
```

Relevant modules:

- `lib/storage/indexeddb-mirror.ts`: transactions, metadata, per-key revisions,
  snapshots, migration copy, and database deletion.
- `lib/storage/storage-engine.ts`: startup source selection, corruption repair,
  reset protection, and newer-LocalStorage replay.
- `lib/storage/runtime-cache.ts`: hydrated synchronous values and revision clock.
- `lib/storage/storage-revision.ts`: the LocalStorage per-key revision journal.
- `lib/storage/safe-storage.ts`: guarded reads/writes and durable restore flushes.
- `components/StorageBoot.tsx`: initializes storage before data routes mount.

## SSR and hydration rule

Never read `localStorage` during server render.

Unsafe:

```ts
const workouts = JSON.parse(localStorage.getItem('workouts') ?? '[]');
```

Required approach:

- Route data access through the existing storage modules.
- Keep data-dependent routes under `StorageGate`.
- Render a client-safe loading state while `StorageBoot` initializes.
- Never bypass the runtime cache with direct IndexedDB reads in components.

## Storage keys

The agent must inspect existing keys first.

Existing keys are centralized in `lib/storage/keys.ts`. Historical un-namespaced
keys must not be renamed without migration. If new keys are needed, prefer
namespaced keys:

```txt
forkworkout:workouts
forkworkout:history
forkworkout:active-session
forkworkout:settings
forkworkout:storage-version
```

Do not rename existing keys without migration. Add user-data keys to
`MIRRORED_LOCAL_STORAGE_KEYS` so they participate in IndexedDB, recovery,
reset, diagnostics, and cross-tab updates.

Implementation-only keys include:

- `forkworkout:storage-revision`: global revision plus the latest revision and
  deletion state for each managed key.
- `forkworkout:storage-reset-at`: prevents a delayed/blocked database from
  resurrecting explicitly deleted data.

## Revision and abrupt-close recovery

Every managed mutation receives a monotonically increasing revision:

1. The runtime cache changes synchronously.
2. The LocalStorage compatibility value and per-key revision journal are
   updated synchronously when available.
3. The IndexedDB transaction is queued with the same key revision.
4. IndexedDB rejects delayed writes older than the committed revision for that
   key.
5. On startup, LocalStorage keys with revisions newer than IndexedDB are replayed
   individually. IndexedDB-only records are preserved.

Do not replace this with whole-snapshot “LocalStorage wins” reconciliation. A
large record may legitimately exist only in IndexedDB after LocalStorage quota
is exhausted.

## Data versioning

Use a version field if changing persisted shapes.

Example:

```ts
type ForkWorkoutStorageEnvelope<T> = {
  version: number;
  data: T;
};
```

If existing data is raw arrays/objects, support both old and new formats.

## Safe parsing

Recommended behavior:

```ts
function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value);
    return parsed as T;
  } catch {
    return fallback;
  }
}
```

Improve this with runtime validation if the project already uses or can safely add a validation library.

## Workout State Requirements

Workout data should support:

- Workout ID
- Title
- Exercises
- Sets
- Created timestamp
- Updated timestamp

Exercise data should support:

- Exercise ID
- Name
- Sets

Set data should support:

- Set ID
- Reps, optional
- Weight, optional
- Duration/time, optional
- Notes, optional if currently supported

## Session State Requirements

Live session state should support:

- Workout ID
- Started timestamp
- Current exercise index or ID
- Current set index or ID
- Completed set IDs
- Skipped set IDs
- Finished timestamp, optional

Avoid relying only on array indexes if exercises/sets can be edited during an active session.

## History Requirements

Workout history should support:

- History entry ID
- Workout ID
- Workout title at completion time
- Completed timestamp
- Local day key, such as `YYYY-MM-DD`
- Completed set count
- Skipped set count
- Total set count
- Duration, optional

Store both timestamp and day key if calendar uses day-level grouping.

## Date Key Rule

For calendar day comparison, use a stable day key:

```txt
YYYY-MM-DD
```

Generate this from local date when the workout is completed.

Do not compare full ISO timestamps when only the calendar day matters.

## Migration strategy

When changing shape:

1. Detect old shape.
2. Convert to new shape.
3. Save migrated shape.
4. Keep fallback path for invalid data.
5. Do not delete old data until migration succeeds.

When changing storage mechanics:

1. Preserve every stable LocalStorage key.
2. Add backwards-compatible optional IndexedDB metadata.
3. Verify a committed copy before promoting it to primary.
4. Fall back to LocalStorage when IndexedDB is unavailable.
5. Keep reset and JSON/Google Drive restore flows race-free.

Before a schema upgrade, the app may create a migration safety snapshot. This
snapshot is only a short-lived rollback aid: it is shown in **Storage &
recovery**, never presented as a recurring backup, and removed automatically
after 30 days. JSON exports and Google Drive remain the durable user-facing
backup options.

## Error handling

If storage fails:

- App should continue in memory if possible.
- Show helpful message only if the user action failed.
- Avoid noisy user-facing errors for recoverable startup parsing.
- Never report a bulk restore as durable until `flushStoragePersistence()` has
  verified the IndexedDB snapshot.

## Acceptance criteria

- Fresh storage does not leave an empty IndexedDB shell.
- Existing LocalStorage data migrates without loss.
- Corrupted LocalStorage or IndexedDB records do not crash the app.
- IndexedDB unavailability falls back to LocalStorage.
- LocalStorage quota failure does not stop IndexedDB saves.
- A newer completed/edited set survives an abrupt PWA termination before its
  queued IndexedDB transaction.
- A delayed stale write cannot overwrite a newer per-key revision or resurrect
  a newer deletion.
- IndexedDB-only keys survive reconciliation of a different LocalStorage key.
- Explicit deletion cannot be undone by an older database snapshot.
- JSON restore is durable before success is reported.
- Existing workouts still load.
- Completed workouts persist.
- Calendar reflects completed workout days.
- Storage reads do not cause hydration warnings.
