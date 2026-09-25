# Changelog

All notable changes to ForkWorkout are documented here.

The project did not use release tags historically, so older entries are grouped
into dated development milestones reconstructed from the Git history and the
current codebase. Commit links are included where they provide useful detail.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
using `Added`, `Changed`, `Fixed`, `Removed`, and `Security` where appropriate.

## Unreleased

### Added

- Added optional meal details before food photo capture so dish names,
  restaurants, brands, ingredients, cooking methods, and sauces can improve AI
  estimates, with conditional public-web lookup and visible source links.
- Added a Meal Ideas sheet beneath Photo Scan with free local matches from known
  foods and saved recipes, optional structured AI combinations, verified
  nutrition totals, foods-on-hand guidance, detailed preparation views, reusable
  recipe or meal saving, local-match logging, and a separate daily allowance.
- Added optional training-day calorie and macro targets that activate on days
  with completed workouts, plus editable daily fiber and sodium targets.
- Added nutrition-label photo scanning through the existing protected AI scan
  route, with a document-shaped camera, editable detailed nutrients, source
  labeling, and retained confidence values.
- Added 7-day and 30-day nutrition progress summaries with logged-day averages,
  calorie-range consistency, protein-target consistency, and body-weight change.
- Added optional final cooked weight to recipes so portions can be logged by
  either servings or the grams of cooked food eaten.
- Added effective-dated nutrition target history so changing a goal preserves
  the calorie and macro targets that applied to earlier food logs.
- Added visible consumed quantities plus compact edit, duplicate, move, and
  delete actions to each daily nutrition entry.
- Expanded Nutrition Targets with shared body-profile and current-weight inputs,
  a goal timeframe, and selectable calorie, protein, carb, and fat estimates.
- Added saved-recipe editing so ingredients can be added through food search,
  barcode scan, or photo scan, adjusted, removed, and saved back to the recipe.
- Added arbitrary saved-meal portion counts, including a 3× shortcut, and
  allowed intentional repeat logging without weakening day-copy duplicate checks.
- Added an expandable daily nutrient summary for fiber, sugar, and sodium,
  including clear unavailable and potentially incomplete data states.
- Added an in-app square food camera with a direct Photo Scan action above meal
  importing, while preserving gallery upload as a fallback.
- Added a tappable Monday–Sunday nutrition log strip beneath the selected date,
  with checkmarks for days that contain food entries and empty circles otherwise.
- Added an optional hidden owner-key flow on the Nutrition heading that grants
  installation-bound unlimited photo scans and AI meal ideas without embedding
  the key in the client bundle or persisting it in browser storage.
- Added a direct Create recipe action to each meal's Add Food sheet, opening the
  recipe builder with that meal already selected.
- Added a portion-aware recipe builder that stores the full cooked batch,
  accepts ingredients from local and online search, barcode scans, and food
  photos, then logs only the selected share of the recipe.
- Added a live daily AI photo-scan allowance indicator that shows each device's
  configured limit, used scans, and remaining scans without consuming usage.
- Added Vercel Web Analytics page-view tracking through the root app layout.
- Added an in-place saved-meal builder with searchable catalog foods, editable
  gram or millilitre amounts, calculated calories, and immediate reuse.
- Added optional AI food-photo analysis with browser-side image resizing,
  editable multi-food estimates, optional known weights, and confirmation-only
  local nutrition logging.
- Added selective saved-meal creation so any subset of foods logged under a
  meal can become its own reusable meal.
- Added arbitrary custom-food nutrition bases such as values per 40 g or 250 ml,
  with a live per-100 equivalent and automatic quantity scaling.
- Added an explicit combined USDA FoodData Central and Open Food Facts name
  search when the offline catalog does not have a match. The USDA API key
  remains server-only, each result identifies its source, and selected foods
  are cached locally for offline reuse and backups.
- Added selective meal sharing and importing through encrypted links, QR codes,
  self-contained links, and portable files. Imported foods are reviewed and
  stored as a reusable meal rather than silently added to a day.
- Added EAN/UPC food barcode scanning from the rear camera or an uploaded
  image, manual-code fallback, Open Food Facts lookup, editable nutrition
  confirmation, and a bounded offline product cache included in backups.
- Added reusable nutrition meals with 0.5×–2× portions, recent and yesterday
  meal copying, and confirmed whole-day copying with duplicate protection.
- Added a reproducible 1,000-record offline USDA food catalog with English and
  Romanian search, raw/cooked variants, gram and millilitre quantity
  calculation, custom foods, favourites, recents, and local backup/restore
  support.
- Added the first local-first Nutrition dashboard with manual calorie and macro
  targets, optional body-profile calorie suggestions, informational workout
  calories, meal grouping, Quick Add editing, and backup/restore support.
- Added a reversible per-day option to include recorded workout calories in the
  Nutrition calorie allowance without changing the permanent daily target.
- Added multi-stage drop sets to live workouts. Additional weight/reps stages
  remain one completed set, contribute to full reps and volume, persist into
  future sessions, and remain available in history, sharing, and Excel exports.
- Added in-session YouTube video editing from the exercise How to dialog, with
  validated links and the existing exercise-management edit flow preserved.
- Added a persistent Make current action in live workouts so users can switch
  exercise or superset focus without changing the workout order.
- Added drag-and-drop workout ordering inside the program editor.
- Added a dashboard Storage & recovery panel showing the active persistence
  source, last durable save, last recorded backup, approximate local data size,
  record count, revision, JSON export, and restore navigation.
- Added direct access to Storage & recovery alongside the JSON, Excel, and
  Google Drive controls on the History page.
- Added per-key LocalStorage/IndexedDB revision metadata and regression coverage
  for abrupt PWA termination, stale delayed writes, and deletion resurrection.

### Fixed

- Routed mobile barcode product lookups through ForkWorkout's same-origin API,
  preventing browser, installed-PWA, and carrier-network request failures from
  making products already present in Open Food Facts appear unavailable.
- Restored the missing bottom border on the local nutrition matches accordion.
- Prevented a selected goal timeframe from silently collapsing to the same
  calories as the Focused estimate; personalized plans now use their calculated
  pace above the supported calorie floor and identify unusually aggressive goals.
- Removed the duplicate edit action from nutrition food rows so dismissing an
  open three-dot menu cannot accidentally launch the food editor underneath it.
- Prevented portrait barcode previews from cropping their left and right edges
  by using the camera's natural aspect ratio inside a taller contained viewport.
- Moved food-camera guidance below the preview and added flashlight controls on
  devices whose rear camera exposes torch support.
- Reworked food-barcode scanning for landscape phones with a full uncropped
  16:9 camera preview, a wide one-dimensional barcode guide, stronger rotated
  decoding, continuous-focus hints, and side-by-side landscape controls.
- Kept the in-progress recipe open after selecting an ingredient by nesting the
  ingredient and photo pickers within the recipe sheet's modal hierarchy.
- Reversed the photo-estimate editor presentation so editable nutrients reflect
  the amount eaten while the reference card shows the normalized per-100 g values.
- Made food-photo gram edits recalculate calories and macros from a preserved
  per-100 g basis, both during photo review and when editing a logged food.
- Prevented nutrition and custom-exercise modals from focusing an input and
  opening the mobile keyboard before the user chooses a field.
- Stabilized the food-photo Analyze button layout so its loading spinner and
  label no longer overlap on mobile.
- Split food-photo selection into explicit camera and gallery actions so mobile
  users can upload an existing image without being forced into the camera.
- Accepted the server-normalized nested nutrient shape in the food-photo client
  validator, preventing valid AI results from being rejected as incomplete.
- Distinguished exhausted OpenAI API credits and temporary provider throttling
  from an actual project or organization monthly spend limit in food-photo
  errors, so the recovery message now matches the upstream cause.
- Prevented the mobile keyboard from opening automatically with the Add Food
  sheet and obscuring its initial search and action controls.
- Kept exercise-history progress charts inside their dialog on narrow or short
  screens, with contained chart sizing and scrollable metric controls.
- Preserved the workout preview's scroll position when its content remounts
  after viewing and closing an exercise information dialog.
- Made every row in workout and exercise reorder lists draggable on mouse,
  touch, and keyboard instead of limiting dragging to the grip icon.
- Ensured backup recovery replaces edited body entries that share an existing
  ID, and added coverage for weight, measurements, notes, and body profile data.
- Prevented a synchronous LocalStorage save made immediately before an abrupt
  app shutdown from being replaced by an older IndexedDB value on restart.
- Preserved IndexedDB-only records when replaying a different, proven-newer
  LocalStorage key after recovery.
- Removed the misleading “Auto-backup saved” notice from History. Migration
  rollback snapshots are now clearly labeled in Storage & recovery and are no
  longer counted as current user backups.

### Changed

- Moved the optional known total weight above the food photo controls so users
  can provide the strongest portion clue before taking or choosing a photo.
- Collapsed local nutrition matches behind an expandable summary so AI meal
  generation remains easier to reach on small screens.
- Kept Gentle, Recommended, and Focused nutrition estimates stable while adding
  a fourth calorie and macro option calculated from the selected goal timeframe.
- Added subtle category-specific color tints to the breakfast, lunch, dinner,
  and snacks cards so daily food logs are easier to scan at a glance.
- Moved the 7-day and 30-day nutrition progress summary below the meal logging
  categories so daily food entry stays immediately accessible.
- Saved-meal details now allow per-item quantity edits with live nutrient
  recalculation, optional template updates, and serving-aware logged amounts.
- Recipe creation now defaults to saving without logging food, uses clearer
  full-batch serving language, and keeps optional immediate meal logging explicit.
- Consolidated nutrition logging around Add Food: saved meals now appear first,
  photo scanning moved into the sheet, and the redundant Quick Add creation
  shortcut was removed while legacy entries remain editable.
- Saved meal details now show each food's stored amount and update it with the
  selected portion multiplier.
- Added a full-width Import Meal action below Nutrition's primary logging
  controls for pasted links and QR codes, while retaining review before a
  shared meal is saved.
- Updated privacy and attribution text for USDA food-name searches, Open Food
  Facts name/barcode lookups, and reusable-meal sharing.
- Added a direct Nutrition and meals shortcut to the main app dashboard.
- Added a Saved meals shortcut inside each meal category's Add Food sheet,
  carrying that category into the reusable-meal picker automatically.
- Updated the privacy disclosure and credits for optional Open Food Facts
  barcode lookups and the ZXing scanner dependency.
- Renamed the Nutrition dashboard's secondary logging action to Add Meal so
  reusable and previous meals are clearly available beside Add Food.
- Exposed a labeled Save as meal action directly beneath each populated meal
  instead of hiding saving behind a repeat icon.
- Made empty Nutrition meal cards compact and full-width, and added a filled
  apple with a reduced-motion-aware animated calorie card when the daily target
  is reached or exceeded.
- Updated persistence documentation to describe IndexedDB primary storage,
  LocalStorage crash recovery, startup hydration, reset protection, and durable
  backup restoration.
- Limited migration safety snapshots to a 30-day recovery window, after which
  they are removed automatically.

### Security

- Protected owner scan unlocking with a minimum 32-character server secret,
  constant-time comparison, five-attempt hourly IP throttling, and a signed
  HttpOnly SameSite cookie that can be revoked by rotating the secret.

- Protected AI photo analysis behind a server-only OpenAI key, strict file and
  response validation, configurable per-installation and per-IP rate limits,
  a production Redis requirement, and a feature kill switch that leaves all
  non-AI nutrition tools available.

## 2026-08-19 — IndexedDB, short links, and QR sharing

### Added

- Added IndexedDB as the primary local persistence layer, with an in-memory
  synchronous cache and LocalStorage compatibility fallback. Existing users are
  migrated automatically and data-reading routes wait for storage hydration.
  ([cacb24e](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/cacb24e))
- Added recovery protection for unavailable or corrupted IndexedDB, verified
  JSON restores, complete database deletion, reset tombstones, and regression
  tests using a private, Git-ignored real-data fixture.
  ([cacb24e](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/cacb24e))
- Added encrypted, short, expiring workout and program links backed by optional
  Upstash Redis storage. The browser retains the decryption key, while the
  service stores only ciphertext.
  ([aaef790](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/aaef790))
- Added share-service controls including rate limiting, payload limits, TTL,
  monthly quota protection, a service kill switch, and fallbacks to portable
  files or legacy self-contained links.
  ([aaef790](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/aaef790))
- Added QR-code sharing and camera scanning for workouts and programs, with
  method tabs for links and QR codes and a reusable import dialog on the app
  dashboard.
  ([fbdb91c](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/fbdb91c))
- Added coherent date and time controls for editing completed workout history.
  ([60c9347](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/60c9347))

### Changed

- JSON and Google Drive recovery now wait for durable IndexedDB persistence and
  restore backed-up application settings such as onboarding, weekly goal, rest
  sound, and vibration preferences.
  ([cacb24e](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/cacb24e))
- Moved portable workout/program importing back to the dashboard and made the
  sharing flow resilient across browser and installed-PWA navigation.
  ([fbdb91c](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/fbdb91c),
  [aaef790](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/aaef790))

## 2026-08-18 — Workout previews, editable history, and share handoff

### Added

- Added workout preview dialogs to dashboard cards, including exercises, set
  details, exercise information, and a worked-muscle heat map.
  ([d5ac3a5](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/d5ac3a5))
- Added editing for completed workouts, including completion date and time,
  duration, calories, heart rate, notes, RPE, performed exercises, and PR
  exclusions.
  ([d5ac3a5](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/d5ac3a5))
- Added a distinct current-exercise highlight in the live tracker, including
  highlighting both exercises in an active superset.
  ([d5ac3a5](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/d5ac3a5))
- Added PWA share-target handling and a local handoff mechanism so shared links
  opened in a browser can continue into the installed app flow.
  ([a31439d](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/a31439d))

### Fixed

- Fixed nested exercise-information dialogs closing the underlying workout
  preview, preview-close flashes, long-link overflow in import dialogs, and
  touch/scroll friction around muscle-map canvases.
  ([d5ac3a5](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/d5ac3a5),
  [a31439d](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/a31439d))

## 2026-08-06 — History and progress overhaul

### Added

- Added reusable exercise progress charts, selectable progress ranges, paged
  workout history, improved volume visualization, and richer muscle insights.
- Added stronger history statistics and personal-record handling, including
  support for excluding mistaken results without deleting the completed set.
- Added program-progress persistence improvements and broader backup/import
  coverage for program state.

### Fixed

- Corrected historical statistics, progress-range calculations, muscle totals,
  history normalization, and several program progression edge cases.

See [841b115](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/841b115).

## 2026-07-28 — Programs and program generation

### Added

- Added user-created workout programs with ordered workout membership, active
  program state, progress tracking, sharing, backup/import, and dashboard cards.
  ([70606cd](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/70606cd))
- Added a program wizard capable of generating multi-workout plans from the
  smart workout generator.
  ([b1b0b9d](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/b1b0b9d))
- Added stretching exercises and improved exercise-replacement coverage.
  ([e59d86a](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/e59d86a),
  [6e14e97](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/6e14e97))

### Changed

- Simplified live-workout exercise controls and expanded replacement options.
  ([4fe2278](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/4fe2278))

## 2026-07-21 to 2026-07-22 — Personalized smart workout engine

### Added

- Added a history-aware recommendation engine with exercise scoring,
  eligibility rules, movement-pattern balance, muscle priority, time-budget
  fitting, progression strategies, and human-readable explanations.
- Added readiness and soreness check-ins, persistent exercise preferences,
  performance feedback, and daily training state.
- Added in-workout and wizard exercise replacement suggestions that respect
  equipment, preferences, movement patterns, and current workout structure.
- Added stable exercise identifiers and expanded regression coverage for smart
  recommendations and persisted personalization.
  ([0a71bdd](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/0a71bdd))
- Added editing for custom exercises and expanded/corrected the built-in
  exercise library, muscle mappings, and exercise videos.
  ([81811cb](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/81811cb))

### Changed

- Refined the live tracker, exercise information, replacement dialog, and
  workout wizard layouts for mobile use.
  ([73852a6](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/73852a6),
  [c89888b](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/c89888b))

### Fixed

- Corrected exercise-replacement selection and duplicate/incompatible
  replacement edge cases.
  ([0e09d08](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/0e09d08))
- Decoupled rest-timer sounds from unrelated background-media muting behavior.
  ([e5ca20e](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/e5ca20e))

## 2026-07-06 — Session resilience, exercise discovery, and Google Drive backup

### Added

- Added a minimizable rest timer, persisted rest countdowns, timer sound
  controls, next-set context, and an in-progress banner that survives leaving
  and resuming a workout.
- Added leave confirmation with keep-or-discard behavior, mid-session exercise
  removal, and prevention of accidental completion while sets remain pending.
- Added the full exercise-library browser with search, muscle-map selection,
  fine-grained muscle filters, and add-by-muscle flows in the builder and live
  session.
- Added optional client-side Google Drive backup and restore, app-wide or
  bring-your-own OAuth client configuration, clearer OAuth errors, and an
  “Open in Drive” link.
- Added Privacy Policy and Terms of Service pages.

### Changed

- Session targets now use the user’s average historical completion time.
- Weekly statistics now use a Monday–Sunday calendar week instead of a rolling
  seven-day window.

See commits from
[af780c4](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/af780c4)
through
[95f868c](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/95f868c).

## 2026-07-04 — Mobile tracker and guided generation

### Added

- Added the mobile bottom navigation for Dashboard, History, Body, and
  Exercises.
- Added live-set rep/weight steppers, larger set cards, per-set comparison with
  the previous session, a celebratory finish summary, and next-set rest-timer
  context.
- Added repeat-last-workout quick start and one-tap progressive-overload
  adjustments.
- Added goal-based workout generation with three ranked options, estimated
  loads, individual-muscle selection, interactive muscle-map previews, home
  equipment and weight-cap filtering, and pull-up-bar support.
- Added a guided-builder path to the landing page and first-run onboarding.
- Added credits/licenses and direct feedback links.
- Added the initial Vitest suite and CI checks for lint, tests, and production
  builds.

### Fixed

- Improved muscle-map touch performance and rendering, wizard loading and
  sticky actions, unit switching, builder validation, and newly added exercise
  scrolling.
- Added home equipment to JSON backup/import and automatic restore.

See commits from
[092b8d4](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/092b8d4)
through
[42e808d](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/42e808d).

## 2026-07-03 — Exercise manager, body insights, records, and offline PWA

### Added

- Added custom exercises, an exercise-management page, custom exercise sharing,
  and exercise reordering in both the builder and live tracker.
- Added completed-workout wearable fields for calories and average/max heart
  rate, plus Excel export for viewing.
- Added weekly workout goals, first-run onboarding, last-session set values,
  personal records, mid-workout PR notifications, and true superset grouping.
- Added body profile calculations for BMI, BMR, calorie targets, and estimated
  body fat, alongside editable measurement history, goal weight, trend
  projection, and explanatory hints.
- Added historical muscle-group insights and anatomical worked-muscle heat maps
  with primary/secondary weighting, including a live workout heat map.
- Added offline fallback, stronger PWA caching, rest-timer vibration, and
  installed-app start-page precaching.

### Fixed

- Added comma-decimal support for iOS numeric inputs and improved body-profile
  typing and missing-measurement guidance.
- Expanded JSON backups to include body profile and settings.
- Hid rest vibration where the browser does not support it.

See commits from
[a39524e](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/a39524e)
through
[478fcf6](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/478fcf6).

## 2026-07-02 — Generator, richer sessions, sharing, and PWA installation

### Added

- Added the first guided workout generator, active-session banner, richer rest
  controls, session table, distance-based sets, history metrics, and exercise
  form demonstrations.
- Added progressive-overload statistics and per-exercise progress charts.
- Added set types, set/session RPE, notes, supersets, exercise duplication, and
  reordering during live workouts.
- Added bodyweight and measurement tracking at `/body`.
- Added versioned storage migrations with one-time automatic backup and restore.
- Added self-contained, backend-free workout links with optional messages,
  shared-workout labels, and collision-safe import naming.
- Added dark/light themes, an installable PWA manifest and icons, a smart install
  button, and platform-specific installation guidance.
- Added repository agent instructions, architecture notes, QA guidance, and
  review templates.

### Removed

- Retired the bundled P90X program and its dedicated dashboard/video flows in
  favor of starter workouts and the guided generator.

See commits from
[5972dea](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/5972dea)
through
[cc9d77b](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/cc9d77b).

## 2026-07-01 — Major product and UI revamp

### Added

- Added the modern landing page, `/app` dashboard, `/history` experience,
  starter workouts, shared layouts, reusable empty states, cards, alerts,
  sheets, tabs, progress, and toast feedback using shadcn/ui and Tailwind.
- Added centralized, guarded persistence with stable storage keys, corrupted-data
  fallbacks, legacy-shape normalization, persisted active sessions, and local
  day keys for timezone-safe calendar and streak calculations.
- Added a validated workout builder with stable IDs and sticky actions, plus a
  live tracker with complete/skip state, progress, rest feedback, exit
  confirmation, and exercise information.
- Added per-set Kg, bodyweight, and time units; volume history charts;
  individual history deletion; full data deletion; add-set choices; tap-to-undo;
  finish confirmation; reliable rest sounds; and screen wake lock.

### Changed

- Reworked the application into a mobile-first fitness product with accessible
  controls, reduced-motion support, stronger metadata, clearer empty states, and
  action-oriented onboarding.

See
[fe78178](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/fe78178),
[8075f27](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/8075f27),
[9b722ba](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/9b722ba),
and
[0a313fb](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/0a313fb).

## 2025-12-09 to 2025-12-17 — Security maintenance

### Security

- Updated Next.js and React packages for React Flight/RSC remote-code-execution
  advisories.
  ([d1bcc6c](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/d1bcc6c),
  [60cdb23](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/60cdb23))

## 2025-10-22 to 2025-10-27 — Exercise discovery and tracker cleanup

### Added

- Added a searchable exercise combobox backed by an expanded exercise catalog,
  plus carousel, command, and popover UI primitives.
  ([74059ef](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/74059ef))

### Fixed

- Improved create-workout and tracker alignment, missing exercise handling,
  exercise removal wording, cleanup, and YouTube links.
  ([a4bb3f9](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/a4bb3f9),
  [b55fc13](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/b55fc13))

## 2025-07-30 — P90X program support

### Added

- Added P90X workouts, phases, and rest weeks to the original dashboard and
  live-session experience.
  ([dab7711](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/dab7711),
  [b03222c](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/b03222c),
  [76cfa00](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/76cfa00))

## 2025-04-25 to 2025-04-28 — Initial workout tracker

### Added

- Created the Next.js application and the first ForkWorkout product experience.
- Added workout creation and editing, dynamic exercises and sets, saved workout
  cards, live workout tracking, a calendar, navigation, and the initial
  shadcn/ui setup.
- Added rest start/end sounds, workout deletion confirmation, and exercise video
  links.
  ([3819d32](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/3819d32),
  [bd0f045](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/bd0f045),
  [85f6db8](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/85f6db8))

### Fixed

- Corrected zero-value input handling and early layout/visual issues.
  ([6fe9456](https://github.com/RaresSanduConstantin/Forkworkout-nextjs/commit/6fe9456))

## Maintenance rules

- Read this file before starting feature or bug work to avoid duplicating
  existing functionality and to identify improvement opportunities.
- Add meaningful work to `Unreleased` in the same change that implements it.
- Record user-facing features, fixes, removals, security updates, data/storage
  migrations, significant architecture changes, and important dependencies.
- Do not log formatting-only edits, internal experimentation, or generated lock
  file noise unless it changes supported behavior or security.
- When a release or milestone is cut, move the `Unreleased` entries into a dated
  section and restore `Nothing yet.` under `Unreleased`.
