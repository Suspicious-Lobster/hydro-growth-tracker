import React, { useState } from 'react';
import { Beaker, Droplets } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAppData } from '../contexts/AppDataContext';
import Modal from './ui/Modal';
import { FEEDING_SCHEDULE, stageToWeek } from '../data/feedingSchedule';
import { toLiters, volumeUnitLabel } from '../utils/format';

// `plantStage` is a GROWTH_STAGES value used to preselect the matching week.
const NutrientCalculator = ({ plantStage = null, onClose }) => {
  const { colors } = useTheme();
  const { settings } = useAppData();
  const volumeUnit = settings.units.volume;

  const [reservoirSize, setReservoirSize] = useState(20);
  const [selectedWeek, setSelectedWeek] = useState(() => stageToWeek(plantStage));
  const [calculation, setCalculation] = useState(null);

  const handleCalculate = () => {
    const week = FEEDING_SCHEDULE.find((w) => w.week === selectedWeek) || FEEDING_SCHEDULE[5];
    const liters = toLiters(parseFloat(reservoirSize) || 0, volumeUnit);
    const round = (v) => Math.round(v * 10) / 10;
    setCalculation({
      ...week,
      reservoirSize: parseFloat(reservoirSize) || 0,
      liters: round(liters),
      perLiter: { a: week.part_a_ml, b: week.part_b_ml, mkp: week.mkp_ml || 0 },
      total: {
        a: round(week.part_a_ml * liters),
        b: round(week.part_b_ml * liters),
        mkp: week.mkp_ml ? round(week.mkp_ml * liters) : 0,
      },
    });
  };

  const inputCls = `w-full px-3 py-2 ${colors.bgAccent} border ${colors.border} rounded-lg ${colors.text}`;

  return (
    <Modal title="Professional Feeding Calculator" onClose={onClose}>
      <p className={`${colors.textMuted} mb-4 text-sm`}>
        Get exact nutrient amounts for each growth week, scaled to your reservoir.
      </p>

      <div className={`${colors.bgAccent} rounded-lg p-4 mb-6`}>
        <h3 className={`text-lg font-semibold ${colors.text} mb-4 flex items-center gap-2`}><Beaker size={20} /> Reservoir Setup</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className={`block text-sm font-medium ${colors.text} mb-2`}>Reservoir Size ({volumeUnitLabel(volumeUnit)})</label>
            <input type="number" min="0" value={reservoirSize} onChange={(e) => setReservoirSize(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={`block text-sm font-medium ${colors.text} mb-2`}>Growth Week</label>
            <select value={selectedWeek} onChange={(e) => setSelectedWeek(parseInt(e.target.value, 10))} className={inputCls}>
              {FEEDING_SCHEDULE.map((w) => (
                <option key={w.week} value={w.week}>Week {w.week} — {w.stage} (EC {w.ec})</option>
              ))}
            </select>
          </div>
        </div>
        <button onClick={handleCalculate} className={`w-full ${colors.primaryBg} text-white py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity`}>
          Calculate Nutrients
        </button>
      </div>

      {calculation && (
        <div className={`${colors.bgAccent} rounded-lg p-4`}>
          <h3 className={`text-lg font-semibold ${colors.text} mb-4 flex items-center gap-2`}><Droplets size={20} /> Your Recipe</h3>

          <div className={`${colors.bgSecondary} rounded-lg p-3 mb-4 grid grid-cols-3 gap-3 text-center`}>
            <Summary colors={colors} label="Reservoir" value={`${calculation.liters} L`} />
            <Summary colors={colors} label="Week" value={calculation.week} />
            <Summary colors={colors} label="Target EC" value={calculation.targetEC ?? calculation.ec} />
          </div>

          <h4 className={`font-semibold ${colors.text} mb-2`}>Total for {calculation.liters} L:</h4>
          <div className={`${colors.bgSecondary} rounded-lg p-3 grid ${calculation.total.mkp > 0 ? 'grid-cols-3' : 'grid-cols-2'} gap-4 text-center mb-4`}>
            <Total colors={colors} value={`${calculation.total.a} ml`} label="Part A" />
            <Total colors={colors} value={`${calculation.total.b} ml`} label="Part B" />
            {calculation.total.mkp > 0 && <Total colors={colors} value={`${calculation.total.mkp} ml`} label="MKP" />}
          </div>

          <div className={`${colors.bgSecondary} rounded-lg p-3 text-sm space-y-1 ${colors.textMuted}`}>
            <div>• Mix order: Part A → Part B{calculation.total.mkp > 0 ? ' → MKP' : ''}, stirring between each.</div>
            <div>• Check pH after mixing (target 5.5–6.5).</div>
            <div>• Confirm EC reads {calculation.ec} ±0.1.</div>
            <div className="italic mt-1">{calculation.notes}</div>
          </div>
        </div>
      )}
    </Modal>
  );
};

const Summary = ({ colors, label, value }) => (
  <div>
    <span className={`${colors.textMuted} text-sm`}>{label}</span>
    <div className={`font-bold ${colors.text}`}>{value}</div>
  </div>
);

const Total = ({ colors, value, label }) => (
  <div>
    <div className={`text-2xl font-bold ${colors.primary}`}>{value}</div>
    <div className={`text-sm ${colors.textMuted}`}>{label}</div>
  </div>
);

export default NutrientCalculator;
