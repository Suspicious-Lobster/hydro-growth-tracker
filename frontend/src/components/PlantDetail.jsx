import React from 'react';
import { ArrowLeft, Droplets, Leaf, Calendar, Beaker } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAppData } from '../contexts/AppDataContext';
import GrowthChart from './GrowthChart';
import ReservoirLog from './ReservoirLog';
import { sortLogsByDate, latestLog, currentHeight, totalGrowth, daysTracked, growthRate } from '../utils/stats';
import { formatLength, formatTemp, formatVolume, formatDate, fromCm } from '../utils/format';
import { inferStage, stageLabel, getStageGuidance } from '../data/recommendations';
import { measurementAlerts, describeAlert } from '../utils/ranges';
import { vpdKpa, vpdBand } from '../utils/vpd';
import { idealSeries } from '../utils/idealCurve';

const PlantDetail = ({ plant, onBack }) => {
  const { colors } = useTheme();
  const { schedules, settings, getPlantLogs } = useAppData();
  const { length: lengthUnit, temp: tempUnit, volume: volumeUnit } = settings.units;

  const logs = getPlantLogs(plant);
  const sorted = sortLogsByDate(logs);
  const latest = latestLog(logs);
  const stage = latest ? inferStage(plant.species, latest.height, latest.growth_stage) : plant.target_stage;
  const guidance = getStageGuidance(plant.species, stage);
  const alerts = latest ? measurementAlerts(latest, plant.species, stage) : [];
  const plantSchedules = schedules.filter((s) => s.plant_id === plant.id);

  // Expected-height curve from the species profile, aligned to each log's
  // date, when the plant has a recorded start date (MR-48). null when it
  // doesn't, so GrowthChart never draws an ideal line with nothing to anchor it.
  const ideal = plant.start_date
    ? idealSeries(plant.species, plant.start_date, sorted.map((l) => l.date ?? l.created_at))
    : null;

  const chartData = sorted.map((log, i) => ({
    date: formatDate(log.date ?? log.created_at, { year: undefined }),
    // Convert canonical cm to the active display unit so the plotted line
    // matches the axis label and the stat cards.
    height: log.height == null ? null : Math.round(fromCm(parseFloat(log.height), lengthUnit) * 100) / 100,
    ph: log.ph != null ? parseFloat(log.ph) : null,
    ec: log.ec != null ? parseFloat(log.ec) : null,
    vpd: vpdKpa(log.air_temp, log.humidity),
    ideal: ideal && ideal[i] != null ? Math.round(fromCm(ideal[i], lengthUnit) * 100) / 100 : undefined,
  }));

  return (
    <div className="space-y-6">
      <button onClick={onBack} className={`flex items-center gap-2 text-sm ${colors.textMuted} hover:${colors.text}`}>
        <ArrowLeft size={16} /> All plants
      </button>

      {/* Metadata header */}
      <div className={`${colors.bgSecondary} rounded-xl shadow-lg p-6 ${colors.border} border`}>
        <div className="flex flex-wrap gap-6">
          <Meta colors={colors} icon={<Leaf size={14} />} label="Species" value={plant.species || '—'} />
          <Meta colors={colors} label="Variety" value={plant.variety || '—'} />
          <Meta colors={colors} icon={<Beaker size={14} />} label="System" value={plant.system_type || '—'} />
          <Meta colors={colors} label="Reservoir" value={plant.reservoir_volume != null ? formatVolume(plant.reservoir_volume, volumeUnit) : '—'} />
          <Meta colors={colors} icon={<Calendar size={14} />} label="Started" value={plant.start_date ? formatDate(plant.start_date) : '—'} />
          <Meta colors={colors} label="Stage" value={stage ? stageLabel(stage) : '—'} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <BigStat colors={colors} value={formatLength(currentHeight(logs), lengthUnit)} label="Current height" />
        <BigStat colors={colors} value={`+${formatLength(totalGrowth(logs), lengthUnit)}`} label="Total growth" />
        <BigStat colors={colors} value={daysTracked(logs)} label="Days tracked" />
        <BigStat colors={colors} value={`${Math.round(fromCm(growthRate(logs), lengthUnit) * 100) / 100} ${lengthUnit}/d`} label="Growth rate" />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
          <h3 className="text-red-400 font-semibold mb-2">Out-of-range readings</h3>
          <ul className="text-sm text-red-300 space-y-1">
            {alerts.map((a) => {
              const d = describeAlert(a, { temp: tempUnit });
              return <li key={a.key}>{a.label}: {d.value} (target {d.range})</li>;
            })}
          </ul>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 1 && (
        <div className={`${colors.bgSecondary} rounded-xl shadow-lg p-5 ${colors.border} border`}>
          <h3 className={`text-lg font-semibold ${colors.text} mb-3`}>Growth, pH, EC &amp; VPD</h3>
          <div className="h-72">
            <GrowthChart data={chartData} lengthUnit={lengthUnit} phRange={guidance?.phRange} ecRange={guidance?.ec} vpdRange={stage ? vpdBand(stage) : null} species={plant.species} />
          </div>
        </div>
      )}

      {/* Stage guidance */}
      {guidance && (
        <div className={`${colors.bgSecondary} rounded-xl shadow-lg p-5 ${colors.border} border`}>
          <h3 className={`text-lg font-semibold ${colors.text} mb-2 flex items-center gap-2`}>
            <Droplets size={18} /> {guidance.label} guidance
          </h3>
          <div className={`text-sm ${colors.textMuted} space-y-1`}>
            {guidance.ec && <div>Target EC: {guidance.ec.min}–{guidance.ec.max}</div>}
            {guidance.phRange && <div>Target pH: {guidance.phRange.min}–{guidance.phRange.max}</div>}
            {guidance.feeding && <div>Feeding: {guidance.feeding.details}</div>}
            {guidance.care?.monitoring && <div>Monitor: {guidance.care.monitoring}</div>}
          </div>
        </div>
      )}

      {/* Schedules */}
      {plantSchedules.length > 0 && (
        <div className={`${colors.bgSecondary} rounded-xl shadow-lg p-5 ${colors.border} border`}>
          <h3 className={`text-lg font-semibold ${colors.text} mb-3`}>Feeding schedules</h3>
          <div className="space-y-2">
            {plantSchedules.map((s) => (
              <div key={s.id} className={`${colors.bgAccent} rounded-lg p-3 text-sm ${colors.text}`}>
                {s.nutrient_type} • EC {s.ec_level} • {s.frequency}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reservoir */}
      <ReservoirLog plant={plant} />

      {/* History table */}
      <div className={`${colors.bgSecondary} rounded-xl shadow-lg p-5 ${colors.border} border`}>
        <h3 className={`text-lg font-semibold ${colors.text} mb-3`}>Measurement history</h3>
        {sorted.length === 0 ? (
          <p className={colors.textMuted}>No logs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`text-left ${colors.textMuted} border-b ${colors.border}`}>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Height</th>
                  <th className="py-2 pr-4">pH</th>
                  <th className="py-2 pr-4">EC</th>
                  <th className="py-2 pr-4">PPM</th>
                  <th className="py-2 pr-4">Air</th>
                  <th className="py-2 pr-4">RH</th>
                </tr>
              </thead>
              <tbody>
                {[...sorted].reverse().map((log) => (
                  <tr key={log.id} className={`border-b ${colors.border} ${colors.text}`}>
                    <td className="py-2 pr-4 whitespace-nowrap">{formatDate(log.date ?? log.created_at)}</td>
                    <td className="py-2 pr-4">{formatLength(log.height, lengthUnit)}</td>
                    <td className="py-2 pr-4">{log.ph ?? '—'}</td>
                    <td className="py-2 pr-4">{log.ec ?? '—'}</td>
                    <td className="py-2 pr-4">{log.ppm ?? '—'}</td>
                    <td className="py-2 pr-4">{log.air_temp != null ? formatTemp(log.air_temp, tempUnit) : '—'}</td>
                    <td className="py-2 pr-4">{log.humidity != null ? `${log.humidity}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const Meta = ({ colors, icon, label, value }) => (
  <div>
    <div className={`text-xs ${colors.textMuted} flex items-center gap-1`}>{icon}{label}</div>
    <div className={`font-medium ${colors.text}`}>{value}</div>
  </div>
);

const BigStat = ({ colors, value, label }) => (
  <div className={`${colors.bgSecondary} rounded-xl p-4 text-center ${colors.border} border`}>
    <div className={`text-xl font-bold ${colors.primary}`}>{value}</div>
    <div className={`text-xs ${colors.textMuted}`}>{label}</div>
  </div>
);

export default PlantDetail;
