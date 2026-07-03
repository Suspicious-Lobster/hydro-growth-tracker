# 🌿 Hydro Growth Tracker — Workboard

Source of truth for all dev work on the Hydro Growth Tracker. The Kanban Artifact is
regenerated from this file — edit here, then re-render. Cards are grouped into three
columns and tagged by area: `[data]` `[ux]` `[bud]` `[infra]` `[feature]`.

_Last updated: 2026-07-03_

---

## 📋 To Do

_Backlog from the feature quiz, ordered foundational-first (top = tackle first):
data → analytics that depend on it → UX → Bud/delight → platform._

### Data foundation
1. **Per-reading EC tracking** `[data]` — EC as a first-class measurement alongside pH: capture, store, show, edit, chart, CSV.
2. **Nutrient dosing log** `[data]` — record which nutrients and how much (ml/L) at each feeding to reproduce a recipe.
3. **Reservoir change tracker** `[data]` — log full reservoir changes and top-offs with volume; know when water was last refreshed.
4. **VPD calculation + chart** `[data]` — compute Vapor Pressure Deficit from air temp & humidity, chart it, flag out-of-range for stage.
5. **Water & cost tracking** `[data]` — track water/nutrient consumption over a grow and estimate running cost.

### Analytics & insights
6. **Anomaly / drift alerts** `[feature]` — flag pH/EC drifting out of the ideal band across recent readings; Bud warns early.
7. **Grow-vs-ideal comparison** `[feature]` — overlay a plant's curve against the ideal target curve for its species/stage.
8. **Deficiency diagnosis helper** `[bud]` — pick symptoms → likely nutrient issue + fix, driven by the knowledge base.
9. **Harvest prediction refinement** `[bud]` — better harvest countdown (stage transitions, growth rate) with a confidence range.

### UX & workflow
10. **Quick-log fast entry** `[ux]` — one-tap quick log for just pH / EC / height without the full form.
11. **Dashboard widgets** `[ux]` — at-a-glance cards: next feeding, latest readings, alerts, harvest countdown.
12. **Log search & filter** `[ux]` — search/filter the log list by plant, date range, stage, or measurement.
13. **Multi-plant compare overlay** `[ux]` — chart multiple plants on one graph to compare grows side by side.
14. **Photo timeline** `[feature]` — attach photos to logs and scrub growth over time.

### Bud & delight
15. **Bud health-reactive expansion** `[bud]` — deepen Bud's reactions to real plant state + expand his tip knowledge.
16. **Achievements & badges** `[bud]` — reward streaks and milestones (first harvest, 30-day streak) with badges Bud celebrates.

### Platform & reliability
17. **Feeding reminders / notifications** `[feature]` — desktop notifications when a feeding schedule is due (builds on `feedingStatus`). _Strong quick-win — the schedule engine already exists; pull up if you want an early actionable feature._
18. **Backup with photos (zip)** `[data]` — extend backup/restore to bundle the `uploads/` images, not just JSON.
19. **Auto-backup on schedule** `[data]` — automatically write a dated backup file periodically.
20. **CSV / other-app import** `[data]` — import existing grow data from CSV or another tracker.
21. **Installer smoke-test** `[infra]` — run `npm run dist` to confirm the Electron app packages and launches.

## 🔨 Doing

- **Merge PR #2** `[infra]` — review + merge the open PR (`Refactor to first-class plants…`) on GitHub. All dev work currently flows into this branch.

## ✅ Done

- **Backend overhaul** `[data]` — first-class plants, rich measurements, v1→v2 migration. (`0c3fb4e`)
- **Frontend overhaul** `[ux]` — redesigned UX, shared AppData state, knowledge-driven guidance. (`e6239d5`)
- **Review-fix pass** `[data]` — unit-conversion, data-integrity, and cleanup fixes from code review. (`fb6b136`)
- **Bud: 3D mascot** `[bud]` — WebGL "Lush" assistant with guidance, emotes, onboarding tour. (`95b1c7a`)
- **Bud: expansion** `[bud]` — physics drag, new emotes, smarter brain, accessories, sounds. (`7ffb8c5`)
- **Bud: stretch/munch polish** `[bud]` — wider stretch arms, bigger munch cookie. (`ffec0d8`)
- **Data backup & restore** `[data]` — full-store JSON export + destructive restore with confirm. (`089e1ba`)
- **Growth-chart redesign** `[ux]` — themed Recharts ComposedChart, ideal-pH band, per-plant detail.
- **Feeding schedule + pH tracking** `[feature]` — schedule CRUD, mark-fed, pH end-to-end (capture→chart→CSV).
