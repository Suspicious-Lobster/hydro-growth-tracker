import React, { useState } from 'react';
import { Zap } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAppData } from '../contexts/AppDataContext';
import { useToast } from '../contexts/ToastContext';
import { apiErrorMessage } from '../api/api';
import { toCm, lengthUnitLabel } from '../utils/format';
import { todayLocalISO } from '../utils/dates';
import { validateLogByField } from '@shared/validation';

const numOrUndef = (v) => (v === '' || v === null || v === undefined ? undefined : parseFloat(v));

// One-row fast entry for the three numbers a grower checks most often: plant,
// height, pH and EC. Full detail (notes, image, nutrients, doses…) still goes
// through AddLogForm; this is the "I just want to log a reading" path (MR-47).
const QuickLogForm = () => {
  const { colors } = useTheme();
  const { plants, settings, createLog } = useAppData();
  const toast = useToast();

  const [plantId, setPlantId] = useState(plants[0]?.id ?? '');
  const [height, setHeight] = useState('');
  const [ph, setPh] = useState('');
  const [ec, setEc] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const lengthUnit = settings.units.length;

  const handleSubmit = async (e) => {
    e.preventDefault();

    const heightCm = height === '' ? undefined : toCm(parseFloat(height), lengthUnit);
    const payload = {
      plant_id: plantId === '' ? undefined : Number(plantId),
      date: todayLocalISO(),
      height: heightCm,
      ph: numOrUndef(ph),
      ec: numOrUndef(ec),
    };

    const fieldErrors = validateLogByField(payload, { requireDate: true });
    if (fieldErrors.height) {
      setError(fieldErrors.height);
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await createLog(payload);
      toast.success('Logged');
      // Keep the plant selected (and its height, for a quick re-weigh) but
      // clear the readings that change every check.
      setPh('');
      setEc('');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to log'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls = (hasErr) =>
    `w-full px-3 py-2 ${colors.bgAccent} border ${hasErr ? 'border-red-500' : colors.border} rounded-lg ${colors.text} focus:outline-none focus:ring-2 ${hasErr ? 'focus:ring-red-500' : 'focus:ring-blue-500'} transition-colors`;

  return (
    <div className={`${colors.bgSecondary} rounded-xl p-4 shadow-lg ${colors.border} border mb-5 transition-colors duration-300`}>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[10rem]">
          <label className={`block text-xs font-medium ${colors.text} mb-1`}>Plant</label>
          <select
            aria-label="Quick log plant"
            value={plantId}
            onChange={(e) => setPlantId(e.target.value)}
            className={inputCls(false)}
          >
            {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="w-24">
          <label className={`block text-xs font-medium ${colors.text} mb-1`}>{`Height (${lengthUnitLabel(lengthUnit)})`}</label>
          <input
            aria-label="Quick height"
            type="number"
            step="0.1"
            min="0"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            className={inputCls(error)}
          />
        </div>
        <div className="w-20">
          <label className={`block text-xs font-medium ${colors.text} mb-1`}>pH</label>
          <input
            aria-label="Quick pH"
            type="number"
            step="0.1"
            value={ph}
            onChange={(e) => setPh(e.target.value)}
            className={inputCls(false)}
          />
        </div>
        <div className="w-20">
          <label className={`block text-xs font-medium ${colors.text} mb-1`}>EC</label>
          <input
            aria-label="Quick EC"
            type="number"
            step="0.1"
            value={ec}
            onChange={(e) => setEc(e.target.value)}
            className={inputCls(false)}
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className={`${colors.primaryBg} text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50`}
        >
          <Zap size={16} /> Quick log
        </button>
      </form>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
};

export default QuickLogForm;
