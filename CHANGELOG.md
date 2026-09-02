# Changelog

All notable changes to Hydro Growth Tracker. Entries are generated from the
board's done rows (`python tools/changelog_from_board.py <version> <date>`);
row ids point at `docs/board.md`, shas at the commit.

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
