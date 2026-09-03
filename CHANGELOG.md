# Changelog

All notable changes to Hydro Growth Tracker. Entries are generated from the
board's done rows (`python tools/changelog_from_board.py <version> <date>`);
row ids point at `docs/board.md`, shas at the commit.

## 1.4.0 - 2026-09-03

### Tests and CI

- Bud capture strip: a Playwright script that drives every cue in the dev app and saves a contact sheet (MR-70, 4cdfcf7)

### Docs and cleanup

- Docs and version 1.4.0 for the Bud release (MR-71)

### Features

- Bud event bus and cue plumbing: the app can tell Bud what the user is doing, and Bud's body receives named cues (MR-62, 7feb7e8)
- Bud's body performs the reaction cues: peek, nod, wince, cheer, sulk, shrug, facepalm, point, land (MR-64, 55d9440)
- Towelie voice: forgetful, spacey, over-helpful copy for every tip, with a clean-voice switch in Settings (MR-67, 7e98c80)
- Bud sounds: huh, hum, chomp, yawn, steps, giggle - tiny synthesized cues in utils/sound.js (MR-69, 27fcace)
- The app tells Bud what you are doing: readings as you type, saves, deletes, errors, tab changes (MR-63, cc01722)
- More idle life: looks around, scratches, hums, munchies at noon, yawns late, checks his watch, welcomes you back (MR-68, a7aead9)
- Bud wanders: walks to what you are looking at, points at alerts, hops home, with a Stay put switch (MR-65, fe47a66)
- Talk back: type a question to Bud and get an offline, data-grounded, Towelie-flavoured answer (MR-66, 02d7cce)
- Tune the cheer and shrug arm poses so the raised arms stay in front of the leaf (MR-72)

## 1.3.0 - 2026-09-03

### Tests and CI

- validate ladder that knows which test files belong to in-flight rows (MR-36, 1a8482c)
- Playwright e2e coverage for the new features: quick log, reservoir event, dosing, zip backup (MR-58, 95553f4)
- One renderWithProviders helper for component tests; retire the per-component toast fallback (MR-60, 3e3924a)
- Validate on a detached worktree so in-flight worker edits never poison the ladder (MR-61, 3d96855)

### Docs and cleanup

- Docs and version for the feature release: user guide sections, changelog lane F, version 1.3.0 (MR-57)
- Version 1.2.0 and a CHANGELOG (MR-30, 6152151)
- Node 22 baseline: engines field, .nvmrc, and a check that CI matches (MR-35, 4319216)
- TASKS.md: mark auto-backup (18) and installer smoke test (20) done, point every open item at its board row (MR-56, fef60dd)

### Features

- Backend: structured nutrient doses on logs, reservoir-event entity, optional nutrients text, photo replace on edit (TASKS 1, 2, 9, 13 backend half) (MR-37, f5b1e7c)
- VPD calculation, stage bands, chart series and out-of-range alert (TASKS 3) (MR-38, ec676d8)
- EC and pH drift detection with Bud warning early (TASKS 5) (MR-39, ad6c317)
- Deficiency diagnosis helper: pick symptoms, get likely nutrient issue and fix (TASKS 7) (MR-40, 83dc93c)
- Dashboard widgets: next feeding, latest readings, alerts, harvest countdown (TASKS 10) (MR-42, ff1208e)
- Log search and filter: text, plant, date range, stage, measurement presence (TASKS 11) (MR-43, efa3d70)
- Feeding reminders as desktop notifications with a settings toggle (TASKS 16) (MR-44, 1017c0e)
- Dosing UI: dose rows on the add and edit log forms, shown in the log list and CSV (TASKS 1 frontend half) (MR-41, cfa123a)
- Reservoir change tracker UI: log changes and top-offs, see when water was last refreshed (TASKS 2 frontend half) (MR-46, 7ba301d)
- Quick-log fast entry: pH, EC and height in one strip on the dashboard (TASKS 9) (MR-47, 5e81dc4)
- Grow-vs-ideal overlay: expected height curve from the species profile behind the real line (TASKS 6) (MR-48, c9ace1a)
- Harvest prediction with a confidence range from observed stage transitions and growth rate (TASKS 8) (MR-49, 6d7233b)
- Backup with photos: zip export and restore that carries the uploads folder (TASKS 17) (MR-54, 5e2b32a)
- Multi-plant compare overlay: several plants on one chart by day since start (TASKS 12) (MR-50, 81fe9c0)
- Photo timeline in the plant view, and replacing a photo when editing a log (TASKS 13 frontend half) (MR-51, 0a69c85)
- Achievements and badges that Bud celebrates (TASKS 15) (MR-45, 6a8c232)
- Bud health-reactive expansion: reacts to reservoir age, drift, VPD and stage changes, and knows more tips (TASKS 14) (MR-52, c9be6b0)
- Water and cost tracking: consumption per grow and running cost from nutrient prices (TASKS 4) (MR-53, 92b2c70)
- CSV import of logs from another tracker with a dry-run preview (TASKS 19) (MR-55, af05907)
- Mount CostCard in the plant view (MR-59, 7ed2c2b)

## 1.2.0 - 2026-09-02

### Data safety and security

- A damaged data file must never be overwritten with an empty store (MR-1, d957a3b)
- Refuse data files and backups from a NEWER schema version (MR-2, de3715e)
- Write safety: pre-restore snapshot, last-good backup on every save, Windows-safe rename (MR-3, fcce417)
- Plant-name uniqueness across the archive boundary; restore endpoint with clash check (MR-4, 37b7353)
- Lock and relocate the local API: loopback only, random port, per-launch token, no wildcard CORS (MR-5, 7fb2e5f)
- Uploads: remove files when their log or plant is deleted; sniff image bytes and force the extension (MR-7, e21d27d)
- CSV export: neutralise formula cells and write a UTF-8 BOM (MR-8, e21d27d)
- Remove the deprecated delete-logs-by-plant-name route (MR-9, e21d27d)

### Frontend correctness

- Order and display logs by the measurement date the user entered (MR-10, e21d27d)
- Calendar dates are local dates everywhere: form default, display, sorting, streaks (MR-11, a80b8a8)
- Log editing picks the plant from a selector, edits every field, and confirms deletes in-app (MR-12, 5b8561d)
- Mutations refresh in the background instead of unmounting the current view (MR-13, 4e03c77)
- One set of validation rules: the frontend imports the server's validation.js (MR-33, 3aa0990)
- Accessibility floor: labelled controls, focus-trapped dialogs, zero serious axe findings (MR-28, 6ff23d6)
- Seven species in the picker have no profile and silently get generic guidance (MR-34, a0403f4)

### Electron shell and packaging

- Single-instance lock and correct quit lifecycle (MR-6, 6a349f1)
- Real application icons for Windows, macOS and Linux (MR-14, 37178ce)
- Window title, Content-Security-Policy, production menu and About dialog (MR-15, e1374f4)
- Errors go to a log file the user can find, and the error screen can copy them (MR-23, 13cbb42)
- Upgrade Electron 29 to a currently supported major (and electron-builder to match) (MR-16, aab5970)

### Tests and CI

- Backend tests onto vitest with unit coverage of validation and repository (MR-24, e137530)
- Playwright end-to-end suite that drives the real Electron app (MR-19, 1d66a19)
- CI: packaging smoke on Windows, e2e, and a timezone matrix (MR-20, d61c635)
- Component tests for every form and destructive flow (MR-25, b3116bc)
- Invariant tests over the plant knowledge base and feeding programme (MR-26, 69a86a4)
- Lint at zero warnings (MR-27, 56451c5)

### Docs and cleanup

- Remove dead installer scripts and dev-launcher cruft; make package.json describe what is built (MR-17, eaccf18)
- One product name everywhere (MR-18, aec1655)
- LICENSE file, privacy statement and a user guide that says where the data lives (MR-22, 4536e86)
- Docs match the build: README, TASKS pointer, architecture notes for the token and port (MR-29, 45540b3)

## 1.1.0

First-class plants, rich measurements, v1 -> v2 migration, redesigned frontend, Bud the assistant, backup and restore.
