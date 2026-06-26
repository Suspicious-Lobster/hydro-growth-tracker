# 🌿 Hydro Growth Tracker

A cross-platform **Electron desktop app** for tracking hydroponic plant growth.
Log heights, nutrients, notes and photos; visualize growth over time; plan
feeding schedules; and calculate nutrient mixes — all stored locally, fully
offline.

## ✨ Features

- **Plant tracking** — log height, pH, nutrients, notes and photos per plant,
  then view, edit, or delete entries. Rename a plant and every log and schedule
  follows.
- **Growth charts** — height- and pH-over-time visualizations and per-plant
  stats (total growth, days tracked, growth rate).
- **Feeding schedules** — create, edit, delete and mark-as-fed per-plant feeding
  schedules, with stage-based recommendations (Seedling → Vegetative →
  Pre-Flowering → Flowering).
- **Nutrient calculator** — a 16-week professional feeding program with
  reservoir mixing amounts.
- **Plant knowledge base** — built-in growth-stage, EC and environment guidance
  for common crops.
- **CSV & calendar export** — export logs to CSV and feeding schedules to a
  calendar-compatible file.
- **Dark / light themes** — system-aware, with a manual toggle, persisted
  locally.
- **Draft auto-save** — the add-log form preserves unsaved input.

## 🏗️ Architecture

The app runs as a single Electron process:

- **Electron main process** (`main.js`) creates the window and starts a small
  embedded **Express** backend (`server.js`) on `http://localhost:5000`.
- **Frontend** (`frontend/`) is a **React 18 + Vite + Tailwind CSS** app served
  at `http://localhost:5173` in development and from `frontend/dist` in the
  packaged app.
- **Storage** is a single JSON file plus an `uploads/` folder for images. In
  development these live in the project root; in the packaged app they live in
  the per-user app-data directory so they survive updates.

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

- **Dashboard** — overview of tracked plants and their stats.
- **Add Log** — record a growth entry (plant, date, height, optional pH,
  nutrients, notes, optional photo). The form auto-saves a draft as you type.
- **View Logs** — browse, edit (including date and pH), or delete entries.
- **Feeding Schedule** — add, edit, delete and mark schedules as fed; view
  stage-based recommendations; open the nutrient calculator or export a feeding
  calendar.
- **Manage Plants** — add, rename, or remove tracked plants.

## 🧰 Useful scripts

```bash
npm run dev        # Run the app in development
npm run dist       # Build distributable installers
npm run health     # Print a quick environment/health check
npm run test       # Run the project checks (test-e2e.cjs)
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
