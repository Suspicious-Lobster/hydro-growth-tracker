# 🌿 Hydro Growth Tracker

A cross-platform **Electron desktop app** for tracking hydroponic plant growth.
Manage plants as first-class entities, log full grow-room measurements (height,
pH, EC/PPM, temps, humidity, light), get species- and stage-aware guidance with
out-of-range alerts, plan feeding schedules with reminders, and calculate
nutrient mixes — all stored locally, fully offline.

## ✨ Features

- **First-class plants** — create plants with metadata (species, variety, system
  type, reservoir volume, start date, target stage); rename, **archive**, or
  permanently delete them. Plants no longer depend on having a log entry.
- **Rich measurement logging** — per entry, record height plus pH, EC, PPM,
  water/air temperature, humidity, light hours, reservoir volume, growth stage,
  nutrients, notes, and a photo. Every measurement is optional.
- **Species & stage-aware guidance** — recommendations are driven by a built-in
  plant knowledge base (per-species EC/pH targets, feeding, and care), with the
  growth stage inferred from species-specific height ranges (not one global
  curve) or set explicitly.
- **Out-of-range alerts** — the dashboard flags pH/EC/temperature/humidity
  readings that fall outside the species target ranges.
- **Plant detail view** — metadata header, a combined growth + EC chart, stage
  guidance, schedules, and a full measurement history table per plant.
- **Feeding reminders** — schedules support edit/delete and a **Mark fed**
  action; due/overdue feedings surface as tasks with a sidebar badge.
- **Nutrient calculator** — a 16-week professional feeding program scaled to your
  reservoir, preselected to the plant's current stage.
- **Settings** — choose display units (cm/in, L/gal, °C/°F) and PPM scale; data
  is stored canonically and converted for display.
- **CSV & calendar export** — export logs (with measurements) to CSV and the
  feeding program to a calendar-compatible file.
- **Dark / light themes**, **toast notifications**, and **add-log draft
  auto-save**.

## 🏗️ Architecture

The app runs as a single Electron process:

- **Electron main process** (`main.js`) creates the window and starts a small
  embedded **Express** backend (`server.js`) on `http://localhost:5000`.
- **Backend** is layered: `server.js` (HTTP routes) → `validation.js` (request
  validation) → `db/repository.js` (data access + entity helpers) →
  `db/migrate.js` (versioned, non-destructive data-file migration). The
  repository is the single place that touches the data file, which keeps a future
  storage swap localized.
- **Frontend** (`frontend/`) is a **React 18 + Vite + Tailwind CSS** app. Global
  state lives in `AppDataContext` (Context + `useReducer`); pure logic lives in
  `src/utils/*` and `src/data/*` and is unit-tested with Vitest.
- **Storage** is a single JSON file plus an `uploads/` folder for images. In
  development these live in the project root; in the packaged app they live in
  the per-user app-data directory so they survive updates. On first launch the
  app **migrates older data files up** (backing the original up first).

There is no separate database server or service to run.

## 🛠️ Installation (development)

Prerequisites: **Node.js 18+** and npm.

```bash
# Install dependencies (Electron shell + frontend)
npm install
cd frontend && npm install && cd ..

# Launch the app (Vite dev server + Electron with the embedded backend)
npm run dev
```

The Electron window opens automatically once the dev server is ready.

## 📦 Building a desktop installer

```bash
npm run dist
```

This builds the frontend and runs **electron-builder**, producing installers in
`dist/`:

- **Windows** — NSIS installer + portable executable
- **macOS** — DMG (x64 + arm64)
- **Linux** — AppImage + `.deb`

Build the platform-native package on the matching OS (or use a CI matrix).

## 📱 Usage

- **Dashboard** — per-plant cards with latest measurements and out-of-range
  alerts; click a plant for its detail view.
- **Add Log** — record a growth entry with full measurements; pick an existing
  plant or create a new one inline. The form auto-saves a draft as you type.
- **View Logs** — browse, edit, or delete entries.
- **Feeding** — see due/overdue feedings, mark them fed, add/edit/delete
  schedules, view species-aware recommendations, open the nutrient calculator,
  or export a feeding calendar.
- **Plants** — create, edit, rename, archive, restore, or delete plants.
- **Settings** — display units and PPM scale.

## 🧰 Useful scripts

```bash
npm run dev          # Run the app in development
npm run dist         # Build distributable installers
npm run health       # Print a quick environment/health check
npm test             # Backend integration tests (with coverage)
npm run test:e2e     # Build/lint/structure smoke gate

# Frontend unit tests (pure logic)
cd frontend && npm run test:unit
```

## 🧪 Tech stack

| Layer    | Tools                                            |
| -------- | ------------------------------------------------ |
| Desktop  | Electron, electron-builder                       |
| Frontend | React 18, Vite, Tailwind CSS, Recharts, Lucide   |
| Backend  | Express, Multer (uploads), json2csv (CSV export) |
| Storage  | Local JSON file + image uploads folder           |

## 📄 License

MIT. See the repository for details.

---

**Happy growing! 🌱**
