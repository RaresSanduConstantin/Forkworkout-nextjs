# Nutrition Feature Roadmap

Last updated: 2026-09-20

This document is the durable implementation checkpoint for ForkWorkout's
local-first Nutrition section. Update it whenever a phase or meaningful task is
completed so work can resume without relying on chat history.

## Product decisions

- Nutrition remains local-first and requires no account.
- IndexedDB is primary; the existing LocalStorage compatibility/recovery path
  remains supported.
- Daily calorie and macro targets are manually controlled.
- Body profile data may offer explicit Cut, Maintain, and Gain calorie
  suggestions, but suggestions never silently overwrite a saved target.
- User-entered calories from completed workouts are informational by default.
  The user may explicitly add them to the food allowance for that day; this
  never changes the permanent daily target or silently affects another day.
- Generic food quantities use metric grams or millilitres.
- A curated, bundled generic-food catalog will support offline search, with raw
  and cooked variants stored as distinct foods.
- Barcode products come from Open Food Facts and are cached locally.
- Nutrition-label OCR is deferred until the core flows and barcode scanner are
  stable. Its first languages will be English and Romanian.
- Label photographs remain on-device and temporary; they are not persisted.
- No paid AI API is part of the initial implementation.

## Shared data principles

- A logged entry stores a nutrition snapshot so later catalog/API changes do
  not rewrite history.
- Capture methods normalize into one food-draft contract. Planned sources are
  `builtin`, `custom`, `barcode`, `label_ocr`, `quick_add`, and a future
  `meal_photo` adapter.
- Calories supplied by a source are retained rather than recalculated from
  macros, because labels and databases may use rounding or additional energy
  sources.
- Persisted reads normalize malformed and legacy values and skip invalid data
  rather than crashing.
- Nutrition data must participate in JSON backup/restore, full reset, storage
  diagnostics, migrations, and IndexedDB revision reconciliation.

## Phase 1 — Daily dashboard and Quick Add

Status: Implemented; device QA and user review pending

- [x] Add versioned nutrition types and calculation helpers.
- [x] Add stable storage keys for daily entries and targets.
- [x] Add normalized CRUD storage for entries and targets.
- [x] Include nutrition in backup, restore, migration snapshots, reset, and
      storage diagnostics.
- [x] Add `/nutrition` behind the existing storage gate.
- [x] Add Nutrition to the mobile bottom navigation.
- [x] Build local-date navigation for previous day, today, and next day.
- [x] Show consumed/target calories, protein, carbohydrates, and fat.
- [x] Show user-entered workout calories and net intake as informational data,
      with an explicit, reversible per-day option to add them to the allowance.
- [x] Group entries into Breakfast, Lunch, Dinner, and Snacks.
- [x] Keep empty meal cards compact and use the available width for a clear
      one-tap Add action.
- [x] Celebrate reaching the calorie target with a filled apple and subtle,
      reduced-motion-aware card animation.
- [x] Add, edit, move, and delete Quick Add entries.
- [x] Add manual target editing.
- [x] Offer explicit Cut/Maintain/Gain calorie suggestions from the latest
      weight and existing body profile when enough data is available.
- [x] Add empty, incomplete-profile, validation, and storage-error states.
- [x] Add unit tests for normalization, calculations, local dates, CRUD, and
      backup/restore/reset behavior.
- [x] Run focused lint, the full automated test suite, and a production build.
- [ ] Perform mobile-focused manual QA on an actual phone/PWA and incorporate
      user review feedback.

### Phase 1 implementation checkpoint

- Route/UI: `app/nutrition/` and `components/nutrition/`
- Data contracts/calculations: `lib/nutrition/`
- Persistence: `lib/storage/nutrition-storage.ts`
- Regression coverage: `test/nutrition.test.ts`
- Validation result: 43 test files and 252 tests passed; production build
  passed with `/nutrition` generated as a static route.

## Phase 2 — Generic foods, custom foods, recents and favourites

Status: Phase 2B implemented; installed-device QA pending

- [x] Create a generated `public/json/foods.json` catalog sourced from USDA
      FoodData Central, with stable IDs and source references.
- [x] Ship 1,000 generic food/preparation records without bundling the raw USDA
      relational download.
- [x] Store raw/cooked/preparation variants as independent records in the
      starter catalog.
- [x] Include English names and useful Romanian search aliases, including
      diacritic-insensitive matching.
- [x] Support per-100g and per-100ml nutrition.
- [x] Merge bundled, custom, recent, and favourite foods into one local search
      experience. Cached barcode foods remain part of Phase 4.
- [x] Add quantity calculation and editable confirmation before logging.
- [x] Add custom-food create/edit/delete flows.
- [x] Rank favourites, frequency, and recency without duplicating history.
- [x] Include custom foods, favourites, and recents in backup, restore, reset,
      IndexedDB reconciliation, and migration recovery.
- [x] Verify the production service worker precaches the bundled food catalog.
- [ ] Perform offline search and logging QA on an installed phone PWA.

### Phase 2 implementation checkpoint

- Catalog: `public/json/foods.json` with 1,000 food/preparation records; 36
  retain hand-curated names and Romanian aliases.
- Reproducible import: `scripts/build-nutrition-catalog.mjs` and
  `docs/NUTRITION_CATALOG.md`.
- Search and ranking: `lib/nutrition/foods.ts`.
- Custom foods and preferences: `lib/storage/nutrition-food-storage.ts`.
- UI: `components/nutrition/FoodPickerSheet.tsx`.
- Validation result: 43 test files and 255 tests passed; production build
  passed and `/json/foods.json` appears in the generated service-worker
  precache manifest.

### Optional catalog follow-ups

- Add more manually reviewed Romanian aliases to generated foods based on real
  search misses.
- Tune category selection and ranking from user feedback rather than increasing
  the catalog size by default.
- Review source links and rounded nutrient values whenever the generator or
  source release changes.

## Phase 3 — Saved and repeated meals

Status: Implemented; device QA and user review pending

- [x] Save a meal's foods and quantities under a reusable name.
- [x] Apply 0.5x, 1x, 1.5x, and 2x multipliers.
- [x] Copy a previous meal into a selected day and meal slot.
- [x] Add shortcuts for yesterday's corresponding meal.
- [x] Copy an entire previous day with duplicate protection and confirmation.
- [x] Assign fresh entry IDs to every copied item.
- [x] Provide a dedicated Add Meal action beside Add Food on the dashboard.
- [x] Surface saved meals inside each category-specific Add Food flow while
      preserving Breakfast, Lunch, Dinner, or Snacks as the destination.
- [x] Provide an explicit Save as meal action inside populated meal cards that
      opens the naming step directly.
- [x] Preserve intentional duplicate foods while skipping only matching entries
      that are already present at the destination.
- [x] Include saved meals in backup, restore, reset, migration recovery, and
      IndexedDB reconciliation.

### Phase 3 implementation checkpoint

- UI: `components/nutrition/MealActionsSheet.tsx` and the Nutrition dashboard's
  Add Meal and Save as meal actions.
- Persistence/copying: `lib/storage/nutrition-meal-storage.ts`.
- Validation result: 43 test files and 258 tests passed; production build
  passed with `/nutrition` generated as a static route.
- [ ] Perform installed-phone QA for the saved-meal and whole-day confirmation
      flows.

## Phase 4 — Barcode scanner

Status: Implemented; installed-device camera QA pending

- [x] Add a dynamically loaded multi-format EAN/UPC scanner with rear-camera,
      torch, image-upload, manual-code, error, and cleanup behavior.
- [x] Look up actual scans through Open Food Facts without using its API for
      search-as-you-type.
- [x] Normalize product names and per-100g/per-100ml macros defensively.
- [x] Confirm/edit incomplete values before logging.
- [x] Cache successful products locally with a timestamp and bounded eviction.
- [x] Use cached products offline and show Open Food Facts attribution.
- [x] Include cached barcode products in backup, restore, reset, migration
      recovery, and IndexedDB reconciliation.
- [ ] Perform installed-phone QA for camera permission, rear-camera selection,
      torch support, image upload, and scan reliability on representative EAN
      and UPC packages.

### Phase 4 implementation checkpoint

- Scanner UI: `components/nutrition/BarcodeScannerPanel.tsx`, opened explicitly
  from the existing Add Food sheet.
- Product adapter: `lib/nutrition/barcodes.ts`, using the Open Food Facts v3
  product endpoint only after a complete barcode is detected or entered.
- Cache: `lib/storage/nutrition-barcode-storage.ts`, capped at 100 confirmed
  products and merged into normal offline food search.
- Scanner dependency: dynamically loaded `@zxing/browser` and
  `@zxing/library`, pinned to Node 20-compatible releases.
- Validation result: 43 test files and 262 tests passed; production build
  passed with `/nutrition` generated as a static route and the scanner loaded
  through a separate dynamic chunk.

## Phase 5 — Experimental label OCR

Status: Deferred

- [ ] Dynamically load Tesseract.js in a worker.
- [ ] Support camera capture and image upload, crop/rotation, contrast
      preprocessing, progress, cancellation, and worker cleanup.
- [ ] Parse English and Romanian nutrient labels, including decimal commas,
      kcal/kJ, per-serving, per-100g/per-100ml, and less-than values.
- [ ] Always present detected values in an editable confirmation form.
- [ ] Store only confirmed nutrition data, never the source photograph.
- [ ] Validate against a fixture set of representative labels before removing
      the experimental designation.

## Resume checklist

When resuming:

1. Read this file and `CHANGELOG.md`.
2. Check `git status` and preserve unfinished/user-owned changes.
3. Continue the first unchecked task in the active phase.
4. Update this checklist in the same change.
5. Run focused tests during development and the full test/build suite before
   marking a phase complete.
