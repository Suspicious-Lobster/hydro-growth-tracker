// Pure badge/achievement engine (MR-45). Given a snapshot of the user's data
// ({ plants, logs }) decides which badges are earned. No DOM, no Date.now()
// inside (the caller injects `now`), mirrors the assistantTips/trends style so
// it stays deterministic and unit-testable.

import { careStreak } from './trends';

// Every badge in display order. Achievements.jsx renders this order; earnedBadges
// and newlyEarned both walk it so ids always come back in a stable order.
export const BADGES = [
  { id: 'first_plant', label: 'First sprout', description: 'Add your first plant.', emoji: '🌱' },
  { id: 'first_log', label: 'First entry', description: 'Log your first entry.', emoji: '📋' },
  { id: 'ten_logs', label: 'Ten logs', description: 'Log ten entries.', emoji: '🔟' },
  { id: 'hundred_logs', label: 'Century club', description: 'Log one hundred entries.', emoji: '💯' },
  { id: 'streak_7', label: 'Week streak', description: 'Log seven days in a row.', emoji: '🔥' },
  { id: 'streak_30', label: 'Month streak', description: 'Log thirty days in a row.', emoji: '🏆' },
  { id: 'first_harvest', label: 'First harvest', description: 'Bring a plant to harvest.', emoji: '🌾' },
  { id: 'photo_fan', label: 'Photo fan', description: 'Attach ten photos to logs.', emoji: '📸' },
  { id: 'chemist', label: 'Chemist', description: 'Log twenty entries with both pH and EC.', emoji: '🧪' },
];

// One earn-rule per badge id, each taking ({ plants, logs }, now).
const RULES = {
  first_plant: ({ plants }) => (plants || []).length >= 1,
  first_log: ({ logs }) => (logs || []).length >= 1,
  ten_logs: ({ logs }) => (logs || []).length >= 10,
  hundred_logs: ({ logs }) => (logs || []).length >= 100,
  streak_7: ({ logs }, now) => careStreak(logs || [], now) >= 7,
  streak_30: ({ logs }, now) => careStreak(logs || [], now) >= 30,
  first_harvest: ({ logs }) => (logs || []).some((l) => l && l.growth_stage === 'harvest_ready'),
  photo_fan: ({ logs }) => (logs || []).filter((l) => l && l.image_url).length >= 10,
  chemist: ({ logs }) => (logs || []).filter((l) => l && l.ph != null && l.ec != null).length >= 20,
};

// Which badges are earned right now, in BADGES order.
export function earnedBadges({ plants = [], logs = [] } = {}, now = new Date()) {
  return BADGES
    .filter((b) => RULES[b.id]({ plants, logs }, now))
    .map((b) => b.id);
}

// Ids present in `currentIds` but not `prevIds`, in BADGES order (so a batch of
// simultaneous new badges is reported in a stable, celebratable order).
export function newlyEarned(prevIds = [], currentIds = []) {
  const prev = new Set(prevIds);
  const current = new Set(currentIds);
  return BADGES.map((b) => b.id).filter((id) => current.has(id) && !prev.has(id));
}
