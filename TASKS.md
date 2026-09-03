# 🌿 Hydro Growth Tracker — Workboard

Source of truth for all dev work on the Hydro Growth Tracker. The Kanban Artifact is
regenerated from this file — edit here, then re-render. Cards are grouped into three
columns and tagged by area: `[data]` `[ux]` `[bud]` `[infra]` `[feature]`.

_Last updated: 2026-09-03_

> **Market-readiness fixes and tests live on the machine board, not here:** `docs/board.md`, read by `python tools/board.py` (`lint`, `wave`, `show <id>`). This file stays the human feature backlog.

---

## 📋 To Do

_Backlog from the feature quiz, ordered foundational-first (top = tackle first):
data → analytics that depend on it → UX → Bud/delight → platform._

### Data foundation
1. **Nutrient dosing log** `[data]` — record which nutrients and how much (ml/L) at each feeding to reproduce a recipe. (board MR-37/MR-41)
2. **Reservoir change tracker** `[data]` — log full reservoir changes and top-offs with volume; know when water was last refreshed. (board MR-37/MR-46)
3. **VPD calculation + chart** `[data]` — compute Vapor Pressure Deficit from air temp & humidity, chart it, flag out-of-range for stage. (board MR-38)
4. **Water & cost tracking** `[data]` — track water/nutrient consumption over a grow and estimate running cost. (board MR-53)

### Analytics & insights
5. **Anomaly / drift alerts** `[feature]` — flag pH/EC drifting out of the ideal band across recent readings; Bud warns early. (board MR-39)
6. **Grow-vs-ideal comparison** `[feature]` — overlay a plant's curve against the ideal target curve for its species/stage. (board MR-48)
7. **Deficiency diagnosis helper** `[bud]` — pick symptoms → likely nutrient issue + fix, driven by the knowledge base. (board MR-40)
8. **Harvest prediction refinement** `[bud]` — better harvest countdown (stage transitions, growth rate) with a confidence range. (board MR-49)

### UX & workflow
9. **Quick-log fast entry** `[ux]` — one-tap quick log for just pH / EC / height without the full form. (board MR-47)
10. **Dashboard widgets** `[ux]` — at-a-glance cards: next feeding, latest readings, alerts, harvest countdown. (board MR-42)
11. **Log search & filter** `[ux]` — search/filter the log list by plant, date range, stage, or measurement. (board MR-43)
12. **Multi-plant compare overlay** `[ux]` — chart multiple plants on one graph to compare grows side by side. (board MR-50)
13. **Photo timeline** `[feature]` — attach photos to logs and scrub growth over time. (board MR-51)

### Bud & delight
14. **Bud health-reactive expansion** `[bud]` — deepen Bud's reactions to real plant state + expand his tip knowledge. (board MR-52)
15. **Achievements & badges** `[bud]` — reward streaks and milestones (first harvest, 30-day streak) with badges Bud celebrates. (board MR-45)

### Platform & reliability
16. **Feeding reminders / notifications** `[feature]` — desktop notifications when a feeding schedule is due (builds on `feedingStatus`). _Strong quick-win — the schedule engine already exists; pull up if you want an early actionable feature._ (board MR-44)
17. **Backup with photos (zip)** `[data]` — extend backup/restore to bundle the `uploads/` images, not just JSON. (board MR-54)
19. **CSV / other-app import** `[data]` — import existing grow data from CSV or another tracker. (board MR-55)

## 🔨 Doing

- **Merge PR #2** `[infra]` — review + merge the open PR (`Refactor to first-class plants…`) on GitHub. All dev work currently flows into this branch.

## ✅ Done

- **Auto-backup on schedule** `[data]` — a dated copy of the data file is written once per day into the backups folder, 14 kept (shipped in MR-3, `fcce417`).
- **Installer smoke-test** `[infra]` — `electron-builder --dir` packaged the app and the built exe launched (mr-run1, 2026-09-02).
- **Growth chart: pH series + ideal bands** `[ux]` — chart now plots pH alongside height & EC on a shared right axis, with the ideal pH/EC target ranges (from stage guidance) shaded behind the lines so out-of-range readings pop. Dark-mode band opacity tuned.
- **Per-reading EC tracking** `[data]` — already shipped with the rich-measurements overhaul: EC capture, store, validate (0–5), edit, display (cards/table/log), chart (right axis), CSV.
- **Backend overhaul** `[data]` — first-class plants, rich measurements, v1→v2 migration. (`0c3fb4e`)
- **Frontend overhaul** `[ux]` — redesigned UX, shared AppData state, knowledge-driven guidance. (`e6239d5`)
- **Review-fix pass** `[data]` — unit-conversion, data-integrity, and cleanup fixes from code review. (`fb6b136`)
- **Bud: 3D mascot** `[bud]` — WebGL "Lush" assistant with guidance, emotes, onboarding tour. (`95b1c7a`)
- **Bud: expansion** `[bud]` — physics drag, new emotes, smarter brain, accessories, sounds. (`7ffb8c5`)
- **Bud: stretch/munch polish** `[bud]` — wider stretch arms, bigger munch cookie. (`ffec0d8`)
- **Data backup & restore** `[data]` — full-store JSON export + destructive restore with confirm. (`089e1ba`)
- **Growth-chart redesign** `[ux]` — themed Recharts ComposedChart, ideal-pH band, per-plant detail.
- **Feeding schedule + pH tracking** `[feature]` — schedule CRUD, mark-fed, pH end-to-end (capture→chart→CSV).
