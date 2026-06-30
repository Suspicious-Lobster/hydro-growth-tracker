import { describe, it, expect } from 'vitest';
import { selectTip, buildCandidates, answerQuestion, RATE_LIMIT_MS, TIP_KINDS } from '../data/assistantTips';

const plant = { id: 1, name: 'Tomato', species: 'tomato', target_stage: null };
const alert = { key: 'ph', label: 'pH', value: 7.4, range: { min: 5.8, max: 6.2 }, status: 'out' };

// A time far past any cooldown so non-alert tips are allowed by default.
const LATE = RATE_LIMIT_MS * 100;

describe('assistantTips.selectTip', () => {
  it('returns null when muted', () => {
    expect(selectTip({ activeTab: 'dashboard', selectedPlant: plant, alerts: [alert] }, { muted: true, now: LATE })).toBeNull();
  });

  it('prioritizes alerts over contextual/idle tips', () => {
    const tip = selectTip({ activeTab: 'feeding', selectedPlant: plant, alerts: [alert], logs: [], stage: 'vegetative' }, { now: LATE });
    expect(tip.kind).toBe('alert');
    expect(tip.expression).toBe('alert');
    expect(tip.id).toBe('alert:1:ph:out');
  });

  it('alerts bypass the rate-limit cooldown', () => {
    // lastShownAt == now -> within cooldown, but an alert should still surface.
    const tip = selectTip({ activeTab: 'dashboard', selectedPlant: plant, alerts: [alert], logs: [] }, { now: 1000, lastShownAt: 1000 });
    expect(tip?.kind).toBe('alert');
  });

  it('suppresses non-alert tips during the cooldown window', () => {
    const tip = selectTip({ activeTab: 'plants', selectedPlant: plant, alerts: [], logs: [] }, { now: 1000, lastShownAt: 1000 });
    expect(tip).toBeNull();
  });

  it('shows a contextual tip once the cooldown has passed', () => {
    const tip = selectTip({ activeTab: 'plants', selectedPlant: plant, alerts: [], logs: [] }, { now: LATE, lastShownAt: 0 });
    expect(tip.kind).toBe('contextual');
    expect(tip.id).toBe('contextual:plants:1');
  });

  it('filters out dismissed tip ids', () => {
    const tip = selectTip(
      { activeTab: 'dashboard', selectedPlant: plant, alerts: [alert], logs: [] },
      { now: LATE, dismissedIds: ['alert:1:ph:out'] },
    );
    // The alert is dismissed, so the next-best (contextual) wins.
    expect(tip.kind).not.toBe('alert');
  });

  it('falls back to a deterministic idle tip when nothing else applies', () => {
    const tip = selectTip({ activeTab: 'dashboard', selectedPlant: null, alerts: [], logs: [] }, { now: 0, lastShownAt: -RATE_LIMIT_MS });
    // dashboard with no plant yields a contextual welcome (priority > idle).
    expect(['contextual', 'idle']).toContain(tip.kind);
  });

  it('is deterministic for the same inputs', () => {
    const args = [{ activeTab: 'feeding', selectedPlant: plant, alerts: [alert], logs: [], stage: 'vegetative' }, { now: LATE }];
    expect(selectTip(...args)).toEqual(selectTip(...args));
  });

  it('supports the public call without an opts object', () => {
    // now defaults to 0, lastShownAt 0 -> within cooldown, only alerts show.
    const tip = selectTip({ activeTab: 'dashboard', selectedPlant: plant, alerts: [alert], logs: [] });
    expect(tip.kind).toBe('alert');
  });
});

describe('assistantTips.buildCandidates', () => {
  it('emits a first-log milestone for a single log', () => {
    const cands = buildCandidates({ activeTab: 'dashboard', selectedPlant: plant, alerts: [], logs: [{ height: 5, date: '2026-01-01' }] });
    expect(cands.some((c) => c.id === 'milestone:first:1')).toBe(true);
  });

  it('emits a growth milestone bucketed to 10cm steps', () => {
    const logs = [
      { height: 5, date: '2026-01-01', created_at: '2026-01-01T00:00:00Z' },
      { height: 28, date: '2026-01-10', created_at: '2026-01-10T00:00:00Z' },
    ];
    const cands = buildCandidates({ activeTab: 'dashboard', selectedPlant: plant, alerts: [], logs });
    expect(cands.some((c) => c.id === 'milestone:growth:1:20')).toBe(true);
  });

  it('orders alert priority above contextual', () => {
    const cands = buildCandidates({ activeTab: 'plants', selectedPlant: plant, alerts: [alert], logs: [] });
    const a = cands.find((c) => c.kind === 'alert');
    const c = cands.find((c) => c.kind === 'contextual');
    expect(a.priority).toBeGreaterThan(c.priority);
    expect(TIP_KINDS.alert).toBeGreaterThan(TIP_KINDS.idle);
  });

  it('ranks the new tiers between alerts and chit-chat', () => {
    expect(TIP_KINDS.alert).toBeGreaterThan(TIP_KINDS.reminder);
    expect(TIP_KINDS.reminder).toBeGreaterThan(TIP_KINDS.milestone);
    expect(TIP_KINDS.milestone).toBeGreaterThan(TIP_KINDS.insight);
    expect(TIP_KINDS.insight).toBeGreaterThan(TIP_KINDS.contextual);
  });

  it('emits a feeding reminder when a schedule is due', () => {
    const now = new Date('2026-02-01').getTime();
    const schedule = { id: 9, plant_id: 1, frequency: 'daily', last_fed: '2026-01-28', active: true, nutrient_type: 'Grow A' };
    const cands = buildCandidates({ activeTab: 'dashboard', selectedPlant: plant, alerts: [], logs: [], schedules: [schedule] }, now);
    const feed = cands.find((c) => c.id === 'reminder:feed:1:9');
    expect(feed).toBeTruthy();
    expect(feed.kind).toBe('reminder');
    expect(feed.text).toMatch(/overdue/);
  });

  it('emits a harvest insight in the harvest window', () => {
    const cands = buildCandidates({ activeTab: 'dashboard', selectedPlant: plant, alerts: [], logs: [], stage: 'harvest_ready' });
    expect(cands.some((c) => c.id === 'insight:harvest:1:harvest_ready' && c.kind === 'insight')).toBe(true);
  });
});

describe('assistantTips.answerQuestion', () => {
  it('asks the user to pick a plant when none is selected', () => {
    expect(answerQuestion({ selectedPlant: null }, 'status').id).toBe('answer:noplant');
    expect(answerQuestion({ selectedPlant: null }, 'action').text).toMatch(/[Pp]ick a plant/);
  });

  it('status summarizes the plant and flags unhealthy readings', () => {
    const a = answerQuestion({ selectedPlant: plant, alerts: [alert], logs: [{ height: 30, date: '2026-01-01' }], stage: 'vegetative' }, 'status');
    expect(a.id).toBe('answer:status:1');
    expect(a.text).toMatch(/Tomato/);
    expect(a.expression).toBe('alert');
  });

  it('action prioritizes fixing an out-of-range reading', () => {
    const a = answerQuestion({ selectedPlant: plant, alerts: [alert], logs: [], schedules: [] }, 'action');
    expect(a.id).toBe('answer:action:alert');
    expect(a.expression).toBe('alert');
  });

  it('action falls through to feeding when readings are fine', () => {
    const now = new Date('2026-02-01').getTime();
    const schedule = { id: 3, plant_id: 1, frequency: 'daily', last_fed: '2026-01-28', active: true, nutrient_type: 'Bloom' };
    const a = answerQuestion({ selectedPlant: plant, alerts: [], logs: [], schedules: [schedule] }, 'action', { now });
    expect(a.id).toBe('answer:action:feed');
  });

  it('fun always returns a non-empty line', () => {
    const a = answerQuestion({ selectedPlant: plant }, 'fun', { now: 0 });
    expect(a.id).toBe('answer:fun');
    expect(typeof a.text).toBe('string');
    expect(a.text.length).toBeGreaterThan(0);
  });
});

describe('assistantTips reminders via selectTip', () => {
  it('nudges to log after a long gap', () => {
    const day = 86400000;
    const now = new Date('2026-02-10').getTime();
    const logs = [{ height: 20, date: '2026-02-01', created_at: '2026-02-01T00:00:00Z' }]; // 9 days stale
    const tip = selectTip({ activeTab: 'dashboard', selectedPlant: plant, alerts: [], logs }, { now, lastShownAt: now - 10 * day });
    expect(tip.id).toBe('reminder:log:1');
    expect(tip.kind).toBe('reminder');
  });

  it('does not nudge to log for a fresh entry', () => {
    const now = new Date('2026-02-02').getTime();
    const logs = [{ height: 20, date: '2026-02-01', created_at: '2026-02-01T00:00:00Z' }];
    const tip = selectTip({ activeTab: 'dashboard', selectedPlant: plant, alerts: [], logs }, { now, lastShownAt: 0 });
    expect(tip?.id).not.toBe('reminder:log:1');
  });
});
