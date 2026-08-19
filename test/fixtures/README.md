# Test fixtures

Real ForkWorkout exports belong in `test/fixtures/private/`. That directory is
Git-ignored because exports can contain health measurements, workout notes, and
other personal data.

`test/private-current-data.test.ts` discovers the latest JSON export in that
directory and runs local regression tests. The suite is skipped when no private
fixture is available, so CI never requires or uploads the private file.
