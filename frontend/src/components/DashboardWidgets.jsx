// MR-42: a 4-tile summary row above the plant grid — next feeding, latest
// reading, active alerts, and harvest countdown — built entirely from
// existing pure helpers (no new business logic here).
import React from 'react';
import { Droplet, Activity, AlertTriangle, Sprout } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAppData } from '../contexts/AppDataContext';
import { latestLog } from '../utils/stats';
import { feedingStatus } from '../utils/feeding';
import { measurementAlerts } from '../utils/ranges';
import { harvestCountdown } from '../utils/trends';
import { inferStage } from '../data/recommendations';
import { formatDate } from '../utils/format';

const Tile = ({ colors, testId, icon, title, children }) => (
  <div className={`${colors.bgSecondary} rounded-xl shadow-lg p-4 ${colors.border} border`} data-testid={testId}>
    <div className={`flex items-center gap-1 text-xs ${colors.textMuted} mb-2`}>
      {icon} {title}
    </div>
    {children}
  </div>
);

// Earliest-due active schedule across all plants, or null when there are none.
function nextFeeding(schedules, plants, now) {
  const active = (schedules || []).filter((s) => s.active !== false);
  if (active.length === 0) return null;
  let best = null;
  let bestStatus = null;
  for (const schedule of active) {
    const status = feedingStatus(schedule, now);
    if (!bestStatus || status.daysUntil < bestStatus.daysUntil) {
      best = schedule;
      bestStatus = status;
    }
  }
  if (!best) return null;
  const plant = (plants || []).find((p) => p.id === best.plant_id) || null;
  return { schedule: best, status: bestStatus, plant };
}

const DashboardWidgets = ({ now = new Date() }) => {
  const { colors } = useTheme();
  const { plants, schedules, getPlantLogs } = useAppData();

  const feeding = nextFeeding(schedules, plants, now);

  let feedingText = 'No schedules';
  let feedingPlantName = '';
  if (feeding) {
    const { status } = feeding;
    feedingPlantName = feeding.plant?.name || '';
    if (status.overdue) feedingText = `overdue ${Math.abs(status.daysUntil)} days`;
    else if (status.due) feedingText = 'due today';
    else feedingText = `in ${status.daysUntil} days`;
  }

  let latest = null;
  let latestPlantName = '';
  let totalAlerts = 0;
  let nearestHarvest = null;

  for (const plant of plants || []) {
    const logs = getPlantLogs(plant);
    const plantLatest = latestLog(logs);
    if (plantLatest) {
      if (!latest || new Date(plantLatest.date) > new Date(latest.date)) {
        latest = plantLatest;
        latestPlantName = plant.name;
      }
      const stage = inferStage(plant.species, plantLatest.height, plantLatest.growth_stage);
      totalAlerts += measurementAlerts(plantLatest, plant.species, stage).length;
    }
    const countdown = harvestCountdown(logs, plant.species, now);
    if (countdown && (!nearestHarvest || countdown.days < nearestHarvest.days)) {
      nearestHarvest = countdown;
    }
  }

  let harvestText = 'none in flowering';
  if (nearestHarvest) {
    harvestText = nearestHarvest.ready ? 'ready' : `${nearestHarvest.days} days`;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
      <Tile colors={colors} testId="widget-feeding" icon={<Droplet size={14} className="text-blue-400" />} title="Next feeding">
        <div className={`text-sm font-bold ${colors.text}`}>{feedingText}</div>
        {feedingPlantName && (
          <div className={`text-xs ${colors.textMuted} truncate`}>{feedingPlantName}</div>
        )}
      </Tile>

      <Tile colors={colors} testId="widget-latest" icon={<Activity size={14} className="text-purple-400" />} title="Latest reading">
        {latest ? (
          <>
            <div className={`text-sm font-bold ${colors.text} truncate`}>{latestPlantName} · {formatDate(latest.date)}</div>
            <div className={`text-xs ${colors.textMuted}`}>
              {latest.ph != null && `pH ${latest.ph}`}
              {latest.ph != null && latest.ec != null && ' · '}
              {latest.ec != null && `EC ${latest.ec}`}
            </div>
          </>
        ) : (
          <div className={`text-sm ${colors.textMuted}`}>No logs yet</div>
        )}
      </Tile>

      <Tile
        colors={colors}
        testId="widget-alerts"
        icon={<AlertTriangle size={14} className={totalAlerts > 0 ? 'text-red-500' : colors.textMuted} />}
        title="Alerts"
      >
        <div className={`text-sm font-bold ${totalAlerts > 0 ? 'text-red-500' : colors.text}`}>{totalAlerts}</div>
      </Tile>

      <Tile colors={colors} testId="widget-harvest" icon={<Sprout size={14} className="text-green-400" />} title="Harvest">
        <div className={`text-sm font-bold ${colors.text}`}>{harvestText}</div>
      </Tile>
    </div>
  );
};

export default DashboardWidgets;
