import React from 'react';
import { TrendingUp, Calendar, AlertTriangle, Leaf, Sprout } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAppData } from '../contexts/AppDataContext';
import { latestLog, currentHeight, totalGrowth, daysTracked } from '../utils/stats';
import { formatLength, formatTemp } from '../utils/format';
import { inferStage, stageLabel, hasOwnProfile } from '../data/recommendations';
import { measurementAlerts, describeAlert } from '../utils/ranges';
import DashboardWidgets from './DashboardWidgets';
import QuickLogForm from './QuickLogForm';

const PlantCard = React.memo(({ plant, logs, lengthUnit, tempUnit, onSelect }) => {
  const { colors } = useTheme();
  const latest = latestLog(logs);
  const stage = latest ? inferStage(plant.species, latest.height, latest.growth_stage) : plant.target_stage;
  const alerts = latest ? measurementAlerts(latest, plant.species, stage) : [];

  return (
    <button
      onClick={() => onSelect(plant.id)}
      className={`text-left ${colors.bgSecondary} rounded-xl shadow-lg p-5 ${colors.border} border hover:ring-2 hover:ring-blue-500/40 transition-all duration-200`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <h3 className={`text-lg font-bold ${colors.primary} truncate`}>{plant.name}</h3>
          <div className={`text-xs ${colors.textMuted} flex items-center gap-1`}>
            <Leaf size={12} />
            {plant.species || 'Unspecified'}{stage ? ` · ${stageLabel(stage)}` : ''}
            {!hasOwnProfile(plant.species) && <span className={colors.textMuted}> · generic guidance</span>}
          </div>
        </div>
        {alerts.length > 0 ? (
          <span className="flex items-center gap-1 text-xs text-red-500 flex-shrink-0">
            <AlertTriangle size={14} /> {alerts.length}
          </span>
        ) : (
          <span className="w-2.5 h-2.5 bg-green-500 rounded-full flex-shrink-0 mt-1" />
        )}
      </div>

      {latest ? (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Stat colors={colors} icon={<TrendingUp size={14} className="text-green-400" />} value={formatLength(currentHeight(logs), lengthUnit)} label="Height" />
            <Stat colors={colors} icon={<TrendingUp size={14} className="text-blue-400" />} value={`+${formatLength(totalGrowth(logs), lengthUnit)}`} label="Growth" />
            <Stat colors={colors} icon={<Calendar size={14} className="text-purple-400" />} value={daysTracked(logs)} label="Days" />
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {latest.ph != null && <Pill colors={colors}>pH {latest.ph}</Pill>}
            {latest.ec != null && <Pill colors={colors}>EC {latest.ec}</Pill>}
            {latest.ppm != null && <Pill colors={colors}>{latest.ppm} ppm</Pill>}
            {latest.air_temp != null && <Pill colors={colors}>{formatTemp(latest.air_temp, tempUnit)}</Pill>}
            {latest.humidity != null && <Pill colors={colors}>{latest.humidity}% RH</Pill>}
          </div>
          {alerts.length > 0 && (
            <div className="mt-3 text-xs text-red-400 space-y-0.5">
              {alerts.map((a) => {
                const d = describeAlert(a, { temp: tempUnit });
                return <div key={a.key}>{a.label} {d.value} out of range ({d.range})</div>;
              })}
            </div>
          )}
        </>
      ) : (
        <div className={`text-sm ${colors.textMuted} py-4 flex items-center gap-2`}>
          <Sprout size={16} /> No logs yet — add the first entry.
        </div>
      )}
    </button>
  );
});
PlantCard.displayName = 'PlantCard';

const Stat = ({ colors, icon, value, label }) => (
  <div className={`${colors.bgAccent} rounded-lg p-2 text-center`}>
    <div className="flex items-center justify-center mb-1">{icon}</div>
    <div className={`text-sm font-bold ${colors.text}`}>{value}</div>
    <div className={`text-[10px] ${colors.textMuted}`}>{label}</div>
  </div>
);

const Pill = ({ colors, children }) => (
  <span className={`${colors.bgAccent} ${colors.textSecondary} px-2 py-0.5 rounded-full`}>{children}</span>
);

const Dashboard = ({ onSelectPlant, now }) => {
  const { colors } = useTheme();
  const { plants, settings, getPlantLogs } = useAppData();
  const lengthUnit = settings.units.length;
  const tempUnit = settings.units.temp;

  if (plants.length === 0) {
    return (
      <div className={`${colors.bgSecondary} rounded-xl shadow-lg p-8 text-center ${colors.border} border`}>
        <Sprout size={64} className={`mx-auto mb-4 ${colors.textMuted} opacity-50`} />
        <h3 className={`text-xl font-semibold ${colors.text} mb-2`}>No Plants Yet</h3>
        <p className={colors.textMuted}>Add a plant from the Plants tab to start tracking its growth.</p>
      </div>
    );
  }

  return (
    <>
      <DashboardWidgets now={now} />
      <QuickLogForm />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {plants.map((plant) => (
          <PlantCard
            key={plant.id}
            plant={plant}
            logs={getPlantLogs(plant)}
            lengthUnit={lengthUnit}
            tempUnit={tempUnit}
            onSelect={onSelectPlant}
          />
        ))}
      </div>
    </>
  );
};

export default Dashboard;
