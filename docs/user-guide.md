# Hydro Growth Tracker - User Guide

This guide is for the person using the app day to day: growing plants,
logging measurements, and keeping your data safe. It is written in plain
language, not for developers.

## First run

The first time you open the app it creates a new, empty data file for you.
Nothing is uploaded anywhere; everything is saved on your own computer (see
"Where your data lives" below).

If you are upgrading from an older version, the app checks your existing
data file and upgrades it automatically the first time you launch the new
version. Before it changes anything, it makes a safety copy named
`hydro-data.backup.v1-<timestamp>.json` next to your data file, so the old
data is never lost.

## Adding plants and logs

1. Open the **Plants** tab and create a plant (name, species, system type,
   reservoir size, start date). You can rename, archive, or delete a plant
   later.
2. Open **Add Log** to record a measurement for a plant. Height and the
   nutrients you used are required; everything else is optional: pH, EC/PPM,
   water and air temperature, humidity, light hours, reservoir volume, growth
   stage, notes, and a photo.
3. Use **View Logs** to browse, edit, or delete past entries.
4. The **Dashboard** shows each plant's latest measurements and flags any
   reading that falls outside the recommended range for its species and
   growth stage.

## Feeding schedules

Open the **Feeding** tab to see feedings that are due or overdue, mark a
feeding as done, and add, edit, or delete schedules. You can also open the
nutrient calculator (it scales a feeding program to your reservoir size) or
export your feeding schedule to a calendar file.

## Settings and units

Open **Settings** to choose your preferred units (cm/in, L/gal, deg C/deg F)
and PPM scale. Your data is stored the same way internally either way; only
the display changes.

## Backup and restore

Open **Settings** and use:

- **Download backup** - saves all of your plants, logs, schedules, and
  settings to a single JSON file that you choose where to save. Photos are
  NOT included in this file.
- **Restore from backup** - pick a backup JSON file to load. This replaces
  everything currently in the app, so you will be asked to confirm first.

To keep your photos too, separately copy the `uploads/` folder (see below)
somewhere safe. A JSON backup alone will not bring photos back.

<!-- MR-3 -->
The app also keeps some safety copies automatically, without you doing
anything:

- `hydro-data.json.bak` - a rolling copy of the last good save.
- `hydro-data.pre-restore-<timestamp>.json` - a snapshot taken right before
  you restore a backup, in case you want to undo the restore.
- A `backups/` folder with one automatic backup per day, keeping the most
  recent 14.

## Where your data lives

The app stores one JSON file plus a folder of photos. The location depends
on your operating system:

- **Windows**: `%APPDATA%\Hydro Growth Tracker\`
- **macOS**: `~/Library/Application Support/Hydro Growth Tracker/`
- **Linux**: `~/.config/Hydro Growth Tracker/`
- **Running from source in development** (`npm run dev`): the project
  folder itself, instead of the locations above.

Inside that folder:

- `hydro-data.json` - all of your plants, logs, schedules, and settings.
- `uploads/` - your photos.

Uninstalling the app on Windows does NOT delete this folder by default, so
your data survives an uninstall/reinstall. If you want to remove your data
completely, delete the folder yourself.

## If the app says your data file is damaged

If `hydro-data.json` cannot be read (for example, it was corrupted by a
crash or a bad edit), the app will NOT overwrite it. Instead it:

1. Copies the broken file to `hydro-data.corrupt-<timestamp>.json` in the
   same folder, so nothing is lost.
2. Shows an error message and a red banner in the app.
3. Refuses to save any changes until the problem is fixed.

To recover, do one of the following, then restart the app:

- Restore your most recent backup using **Settings -> Restore from backup**,
  if the app is able to open.
- Look in your data folder for `hydro-data.json.bak` (the last good
  automatic copy) or a file in the `backups/` folder, and rename it to
  `hydro-data.json`.
- Open `hydro-data.corrupt-<timestamp>.json` in a text editor to see if the
  problem is small enough to fix by hand, then rename it to
  `hydro-data.json`.

## Moving to a new computer

1. On the old computer, find your data folder (see "Where your data lives"
   above).
2. Copy `hydro-data.json` and the `uploads/` folder to the new computer's
   matching data folder (create it if it does not exist yet, or install and
   run the app once first so it creates the folder for you).
3. Start the app on the new computer. It will pick up the copied data.

Alternatively, use **Settings -> Download backup** on the old computer and
**Settings -> Restore from backup** on the new one, then copy the
`uploads/` folder separately to bring your photos across.
