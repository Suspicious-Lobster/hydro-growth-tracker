// Feeding-schedule timing: when a schedule is next due, and whether it's
// overdue. Shared by the feeding view and the sidebar due-count badge.

export const FREQUENCY_DAYS = { daily: 1, 'every-2-days': 2, weekly: 7 };

export const FREQUENCY_LABELS = {
  daily: 'Daily',
  'every-2-days': 'Every 2 days',
  weekly: 'Weekly',
  custom: 'Custom',
};

export function intervalDays(schedule) {
  if (schedule.frequency === 'custom') return schedule.custom_interval_days || 1;
  return FREQUENCY_DAYS[schedule.frequency] || 1;
}

// Days since last fed, the interval, and due/overdue flags.
export function feedingStatus(schedule, now = new Date()) {
  const last = new Date(schedule.last_fed || schedule.created_at);
  const daysSince = Math.floor((now - last) / (1000 * 60 * 60 * 24));
  const interval = intervalDays(schedule);
  const daysUntil = interval - daysSince;
  return {
    daysSince,
    interval,
    daysUntil,
    due: daysUntil <= 0,
    overdue: daysUntil < 0,
  };
}

// Number of active schedules currently due.
export function dueCount(schedules) {
  return (schedules || []).filter((s) => s.active !== false && feedingStatus(s).due).length;
}
