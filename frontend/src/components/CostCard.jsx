import React from 'react';
import { Coins } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAppData } from '../contexts/AppDataContext';
import { costSummary } from '../utils/cost';
import { formatVolume } from '../utils/format';

// Water used, nutrient consumed per product and the running cost for one
// plant (MR-53). Pure numbers from utils/cost.js; prices come from Settings
// (nutrient_prices, per liter of product) and carry no currency symbol on
// purpose: the app never asks which currency you use.
const money = (n) => n.toFixed(2);

const CostCard = ({ plant }) => {
  const { colors } = useTheme();
  const { settings, getPlantLogs, getPlantReservoirEvents } = useAppData();
  const volumeUnit = settings.units.volume;
  const prices = settings.nutrient_prices || [];
  const logs = getPlantLogs(plant);
  const events = getPlantReservoirEvents ? getPlantReservoirEvents(plant) : [];
  const s = costSummary({ logs, events, plant, prices });

  return (
    <div className={`${colors.bgSecondary} rounded-xl shadow-lg p-5 ${colors.border} border`} data-testid="cost-card">
      <h3 className={`text-lg font-semibold ${colors.text} mb-3 flex items-center gap-2`}>
        <Coins size={18} /> Water &amp; cost
      </h3>
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <div className={`text-xs ${colors.textMuted}`}>Water used</div>
          <div className={`text-xl font-bold ${colors.primary}`}>{formatVolume(s.water, volumeUnit)}</div>
        </div>
        <div>
          <div className={`text-xs ${colors.textMuted}`}>Nutrient cost</div>
          <div className={`text-xl font-bold ${colors.primary}`}>{money(s.total)}</div>
        </div>
      </div>
      {s.lines.length > 0 ? (
        <table className="w-full text-sm">
          <thead>
            <tr className={`text-left ${colors.textMuted} border-b ${colors.border}`}>
              <th className="py-1 pr-4">Product</th>
              <th className="py-1 pr-4">Used</th>
              <th className="py-1">Cost</th>
            </tr>
          </thead>
          <tbody>
            {s.lines.map((l) => (
              <tr key={l.name} className={`border-b ${colors.border} ${colors.text}`}>
                <td className="py-1 pr-4">{l.name}</td>
                <td className="py-1 pr-4">{l.ml} ml</td>
                <td className="py-1">{l.cost == null ? 'no price set' : money(l.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className={`text-sm ${colors.textMuted}`}>Log doses on your entries and reservoir changes to track what this grow uses.</p>
      )}
      {s.unpriced.length > 0 && (
        <p className={`text-xs ${colors.textMuted} mt-2`}>
          Unpriced: {s.unpriced.join(', ')}. Add a price per liter in Settings to include them.
        </p>
      )}
      {s.usage.unknownVolume.length > 0 && (
        <p className={`text-xs ${colors.textMuted} mt-1`}>
          {s.usage.unknownVolume.length} dosed {s.usage.unknownVolume.length === 1 ? 'entry has' : 'entries have'} no known reservoir volume: log a full change or set the plant&apos;s reservoir size.
        </p>
      )}
    </div>
  );
};

export default CostCard;
