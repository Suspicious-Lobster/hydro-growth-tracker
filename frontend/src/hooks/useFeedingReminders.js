// MR-44: fire a desktop notification once per day for each active feeding
// schedule that's due, so a user doesn't have to keep the Feeding tab open
// to notice. Pure timer + localStorage bookkeeping; no Electron import here
// (window.Notification works the same in the browser and in a BrowserWindow).
import { useEffect, useRef } from 'react';
import { feedingStatus } from '../utils/feeding';
import { todayLocalISO } from '../utils/dates';

// { [scheduleId]: 'YYYY-MM-DD' } — the calendar day a schedule last fired a
// reminder, so re-checking every 30 minutes doesn't nag more than once a day.
const REMINDED_KEY = 'hydro.reminded';

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000;

function readReminded() {
  try {
    const raw = localStorage.getItem(REMINDED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeReminded(map) {
  try { localStorage.setItem(REMINDED_KEY, JSON.stringify(map)); } catch { /* storage full/unavailable */ }
}

// window.Notification is undefined in plain browsers without a permission
// prompt ever having run, and Electron grants it silently by default, so
// 'default' (never asked) is treated the same as 'granted' here.
export function defaultNotify(title, body) {
  if (typeof window === 'undefined' || typeof window.Notification === 'undefined') return;
  const permission = window.Notification.permission;
  if (permission !== 'granted' && permission !== 'default') return;
  new window.Notification(title, { body });
}

// schedules: array of feeding schedules (from useAppData). enabled: the
// user's toggle (from useAssistant). now/notify are injectable for tests.
export function useFeedingReminders({ schedules, enabled, now = () => new Date(), notify = defaultNotify, interval = DEFAULT_INTERVAL_MS }) {
  // Latest props/callbacks without re-arming the interval on every render.
  const latest = useRef({ schedules, now, notify });
  latest.current = { schedules, now, notify };

  useEffect(() => {
    if (!enabled) return undefined;

    const check = () => {
      const { schedules: currentSchedules, now: currentNow, notify: currentNotify } = latest.current;
      if (!currentSchedules || currentSchedules.length === 0) return;

      const nowDate = currentNow();
      const today = todayLocalISO(nowDate);
      const reminded = readReminded();
      let changed = false;

      for (const schedule of currentSchedules) {
        if (schedule.active === false) continue;
        const status = feedingStatus(schedule, nowDate);
        if (!status.due) continue;
        if (reminded[schedule.id] === today) continue;

        const overdueDays = -status.daysUntil;
        const title = `Feeding due: ${schedule.plant_name}`;
        const body = `${schedule.nutrient_type} — ${status.overdue ? `overdue by ${overdueDays} days` : 'due today'}`;
        currentNotify(title, body);

        reminded[schedule.id] = today;
        changed = true;
      }

      if (changed) writeReminded(reminded);
    };

    check();
    const id = setInterval(check, interval);
    return () => clearInterval(id);
  }, [enabled, interval]);
}

export default useFeedingReminders;
