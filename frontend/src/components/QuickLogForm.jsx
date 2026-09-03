import React, { useState, useRef } from 'react';
import { Zap } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAppData } from '../contexts/AppDataContext';
import { useToast } from '../contexts/ToastContext';
import { apiErrorMessage } from '../api/api';
import { toCm, lengthUnitLabel } from '../utils/format';
import { todayLocalISO } from '../utils/dates';
import { validateLogByField } from '@shared/validation';
import { inferStage } from '../data/recommendations';
import { readingStatus } from './AddLogForm';
import { emitSafe } from '../utils/budBus';
import { BUD_EVENTS } from '../data/budCues';

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
  const selectedPlant = plants.find((p) => p.id === Number(plantId)) || null;

  // MR-63: throttle form:reading to one emit per 400ms per field, always
  // firing the last value after a pause (mirrors AddLogForm's useReadingEmitter,
  // kept local/duplicated rather than shared — it's a few lines).
  const readingTimers = useRef({});
  const emitReading = (field, value, status) => {
    const now = Date.now();
    const entry = readingTimers.current[field] || { last: 0, timer: null };
    if (entry.timer) { clearTimeout(entry.timer); entry.timer = null; }
    const elapsed = now - entry.last;
    const fire = () => {
      entry.last = Date.now();
      emitSafe(BUD_EVENTS.FORM_READING, { field, value, status });
    };
    if (elapsed >= 400) fire();
    else entry.timer = setTimeout(fire, 400 - elapsed);
    readingTimers.current[field] = entry;
  };

  const handlePhChange = (e) => {
    const value = e.target.value;
    setPh(value);
    const heightCm = height === '' ? undefined : toCm(parseFloat(height), lengthUnit);
    const stage = selectedPlant ? inferStage(selectedPlant.species, heightCm, null) : null;
    emitReading('ph', value, readingStatus('ph', value, selectedPlant, stage));
  };

  const handleEcChange = (e) => {
    const value = e.target.value;
    setEc(value);
    const heightCm = height === '' ? undefined : toCm(parseFloat(height), lengthUnit);
    const stage = selectedPlant ? inferStage(selectedPlant.species, heightCm, null) : null;
    emitReading('ec', value, readingStatus('ec', value, selectedPlant, stage));
  };

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
      emitSafe(BUD_EVENTS.SAVE_ERROR, { kind: 'log' });
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await createLog(payload);
      toast.success('Logged');
      emitSafe(BUD_EVENTS.SAVE_OK, { kind: 'log' });
      // Keep the plant selected (and its height, for a quick re-weigh) but
      // clear the readings that change every check.
      setPh('');
      setEc('');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to log'));
      emitSafe(BUD_EVENTS.SAVE_ERROR, { kind: 'log' });
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
            onFocus={() => emitSafe(BUD_EVENTS.FORM_FOCUS, {})}
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
            onChange={handlePhChange}
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
            onChange={handleEcChange}
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
