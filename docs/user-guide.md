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
2. Open **Add Log** to record a measurement for a plant. Height is required;
   everything else is optional: nutrients (as free text, structured doses, or
   both), pH, EC/PPM, water and air temperature, humidity, light hours,
   reservoir volume, growth stage, notes, and a photo.
3. Use **View Logs** to browse, edit, or delete past entries.
4. The **Dashboard** shows each plant's latest measurements and flags any
   reading that falls outside the recommended range for its species and
   growth stage.

## New in 1.3

These features were added in version 1.3.0.

### Doses

On **Add Log** and when editing a log, a "Doses" editor lets you record each
nutrient product by name with its ml/L, up to 10 rows. Doses show as small
pills (for example "Part A 2 ml/L") under the nutrients line in **View
Logs**, and are included as a column in CSV export. The old free-text
nutrients field is now optional, so you can log with doses alone.

### Reservoir tracking

Open a plant's page for a "Reservoir" card. Log a **Full change** or
**Top-off**, with the volume in your display units, a date, and optional
EC/pH/notes. The card shows "Last full change: N days ago" so you always
know how fresh your solution is.

### VPD (vapour pressure deficit)

The plant chart now plots VPD, computed from air temperature and humidity
(leaf temperature is taken as 2 degrees C below air temperature), with a
shaded band showing the ideal range for the plant's growth stage. A VPD
outside that band shows up in the plant's alerts.

### Drift alerts

Bud now warns you early when pH or EC is drifting toward the edge of the
healthy range across your last few readings, instead of waiting until a
reading is already out of range.

### Deficiency helper

Click Bud and choose "Something looks wrong" to tick the symptoms you see
(yellowing leaves, curling, spots, and more). Bud ranks the most likely
nutrient issues and shows a fix for each.

### Dashboard widgets

The Dashboard now shows four tiles above your plant cards: **Next
feeding**, **Latest reading**, **Alerts**, and **Harvest** countdown, so you
can see the state of your whole grow at a glance.

### Log filters

**View Logs** has a filter toolbar: a text search, a plant picker, a date
range, a growth-stage filter, a filter for logs that have a measurement
(pH/EC/PPM/photo), and a "Clear filters" button.

### Feeding reminders

Turn on **Feeding reminders** in Settings under "Fun & Effects" to get a
desktop notification once a day when a feeding is due.

### Badges

Click Bud and choose "Show my badges" to see the achievements you have
earned so far, such as your first log or a 7-day care streak. Bud
celebrates when you earn a new one.

### Quick log

A one-row strip on the **Dashboard** lets you log plant, height, pH, and EC
in seconds, without opening the full Add Log form.

### Ideal curve

When a plant has a start date, its growth chart shows a dashed "Ideal" line
based on the species profile, so you can see how your plant's height
compares to the expected curve for its stage.

### Harvest range

Bud's harvest countdown now gives a range, like "about N days (M-K)", along
with a confidence level based on how your plant's stages have actually
progressed.

### Compare plants

Below the dashboard's plant grid, open the collapsible "Compare plants"
card to pick up to 6 plants and a metric (height, pH, or EC) and see them
plotted together on one chart, aligned by days since each plant started.

### Photo timeline

Once a plant has 2 or more photos, its page shows a photo timeline above
the history table: a slider that scrubs through the photos with a caption
showing the date and height at that point. When editing a log, "Replace
photo" lets you swap in a new image.

### Water and cost

A plant's page shows a "Water & cost" card: total water used, nutrient
usage per product, and an estimated running cost. Set your prices per
liter in **Settings > Nutrient prices**.

### Zip backup

In **Settings > Backup & Restore**, "Download backup with photos" saves a
zip file containing your data plus every photo, so you no longer need to
copy the `uploads/` folder separately. "Restore from zip..." brings it all
back.

### CSV import

In **Settings > Backup & Restore**, "Import logs from CSV..." lets you
bring in logs from another tracker or spreadsheet. It shows a preview of
what will be imported (and any rows with problems) before you confirm.
Required columns are plant, date, and height; everything else is optional.
This app's own CSV export can be re-imported as-is.

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
