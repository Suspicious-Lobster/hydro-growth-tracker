import React, { useState, useEffect, useId, useRef } from 'react';
import { Plus, Minus, Save, AlertCircle, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAppData } from '../contexts/AppDataContext';
import { useToast } from '../contexts/ToastContext';
import { apiErrorMessage } from '../api/api';
import { GROWTH_STAGES } from '../data/plantKnowledge';
import { getProfileStages, stageLabel, getProfile, getStageGuidance, inferStage } from '../data/recommendations';
import { classify } from '../utils/ranges';
import { toCm, toCelsius, toLiters, lengthUnitLabel, tempUnitLabel, volumeUnitLabel } from '../utils/format';
import { todayLocalISO } from '../utils/dates';
import { validateLogByField, DOSES_MAX } from '@shared/validation';
import { emitSafe } from '../utils/budBus';
import { BUD_EVENTS } from '../data/budCues';

// Shared by AddLogForm and QuickLogForm (MR-63): classify a just-typed
// reading against the selected plant's species/stage band so Bud can react
// with an approving nod or a wince. `value` must already be in canonical
// units (Celsius for air_temp; pH/EC/humidity are unitless) — the caller
// converts display units first. `stage` defaults to the plant's own
// target_stage when the caller doesn't have a more specific one (e.g. one
// inferred from the current height, as PlantCards does).
// eslint-disable-next-line react-refresh/only-export-components -- pure helper shared with QuickLogForm, not a component
export function readingStatus(field, value, plant, stage = plant?.target_stage ?? null) {
  if (!plant) return 'unknown';
  const profile = getProfile(plant.species);
  switch (field) {
    case 'ph': return classify(value, profile.phRange);
    case 'humidity': return classify(value, profile.optimalHumidity);
    case 'air_temp': return classify(value, profile.optimalTemp);
    case 'ec': {
      const guidance = getStageGuidance(plant.species, stage);
      return classify(value, guidance?.ec);
    }
    default: return 'unknown';
  }
}

// Emit form:reading at most once per 400ms per field, but always emit the
// last value once the user pauses (a trailing timer) so the final keystroke's
// status still reaches Bud. Tiny and local — not worth sharing as a module.
function useReadingEmitter() {
  const state = useRef({});
  return (field, value, status) => {
    const now = Date.now();
    const entry = state.current[field] || { last: 0, timer: null };
    if (entry.timer) { clearTimeout(entry.timer); entry.timer = null; }
    const elapsed = now - entry.last;
    const fire = () => {
      entry.last = Date.now();
      emitSafe(BUD_EVENTS.FORM_READING, { field, value, status });
    };
    if (elapsed >= 400) fire();
    else entry.timer = setTimeout(fire, 400 - elapsed);
    state.current[field] = entry;
  };
}

const DRAFT_KEY = 'logFormDraft';
const blankForm = () => ({
  plant_name: '',
  // The user's local calendar day, not the UTC one (which is tomorrow in a US
  // evening and yesterday before 2am at UTC+2).
  date: todayLocalISO(),
  height: '',
  growth_stage: '',
  ph: '', ec: '', ppm: '',
  water_temp: '', air_temp: '', humidity: '', light_hours: '',
  reservoir_volume: '',
  nutrients: '',
  doses: [],
  notes: '',
  image: null,
});

const AddLogForm = ({ defaultPlantId = null }) => {
  const { colors } = useTheme();
  const { plants, settings, createLog } = useAppData();
  const toast = useToast();

  const [form, setForm] = useState(blankForm);
  const [plantMode, setPlantMode] = useState('existing'); // 'existing' | 'new'
  const [selectedPlantId, setSelectedPlantId] = useState(defaultPlantId ?? '');
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const { length: lengthUnit, temp: tempUnit, volume: volumeUnit } = settings.units;
  const selectedPlant = plants.find((p) => p.id === Number(selectedPlantId)) || null;
  const emitReading = useReadingEmitter();

  // Default to "new plant" when there are no plants to pick.
  useEffect(() => {
    if (plants.length === 0) setPlantMode('new');
    else if (defaultPlantId) { setPlantMode('existing'); setSelectedPlantId(defaultPlantId); }
  }, [plants.length, defaultPlantId]);

  // Restore text draft on mount (never the image).
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        setForm((prev) => ({ ...prev, ...JSON.parse(saved), image: null }));
        setIsDirty(true);
      } catch { /* ignore corrupt draft */ }
    }
  }, []);

  // Persist text draft on change.
  useEffect(() => {
    if (!isDirty) return;
    const { image, ...rest } = form;
    void image;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(rest));
  }, [form, isDirty]);

  const stageOptions = selectedPlant?.species ? getProfileStages(selectedPlant.species) : Object.values(GROWTH_STAGES);

  const update = (patch) => { setForm((f) => ({ ...f, ...patch })); setIsDirty(true); };

  const READING_FIELDS = ['ph', 'ec', 'humidity', 'air_temp'];

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'image') { update({ image: files[0] || null }); return; }
    update({ [name]: value });
    if (READING_FIELDS.includes(name)) {
      const compareValue = name === 'air_temp' && value !== '' ? toCelsius(parseFloat(value), tempUnit) : value;
      const heightCm = form.height === '' ? undefined : toCm(parseFloat(form.height), lengthUnit);
      const stage = selectedPlant ? inferStage(selectedPlant.species, heightCm, form.growth_stage) : null;
      const status = readingStatus(name, compareValue, selectedPlant, stage);
      emitReading(name, value, status);
    }
  };

  const adjustHeight = (delta) => {
    const cur = parseFloat(form.height) || 0;
    update({ height: String(Math.max(0, Math.round((cur + delta) * 10) / 10)) });
  };

  const numOrUndef = (v) => (v === '' || v === null ? undefined : parseFloat(v));

  const clearDraft = () => { localStorage.removeItem(DRAFT_KEY); setIsDirty(false); };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Build the canonical payload (convert display units -> storage units)
    // first, then validate that exact payload with the server's own rule
    // table (MR-33) — one derivation of every rule and bound, so a value
    // that fails on the server can never first pass a client re-write of it.
    const heightCm = form.height === '' ? undefined : toCm(parseFloat(form.height), lengthUnit);
    const payload = {
      date: form.date,
      height: heightCm,
      growth_stage: form.growth_stage || undefined,
      ph: numOrUndef(form.ph),
      ec: numOrUndef(form.ec),
      ppm: numOrUndef(form.ppm),
      water_temp: form.water_temp === '' ? undefined : toCelsius(parseFloat(form.water_temp), tempUnit),
      air_temp: form.air_temp === '' ? undefined : toCelsius(parseFloat(form.air_temp), tempUnit),
      humidity: numOrUndef(form.humidity),
      light_hours: numOrUndef(form.light_hours),
      reservoir_volume: form.reservoir_volume === '' ? undefined : toLiters(parseFloat(form.reservoir_volume), volumeUnit),
      nutrients: form.nutrients,
      doses: form.doses.filter((d) => d.name.trim()).map((d) => ({ name: d.name.trim(), ml_per_l: parseFloat(d.ml_per_l) })),
      notes: form.notes,
    };
    if (plantMode === 'existing') payload.plant_id = selectedPlant?.id;
    else payload.plant_name = form.plant_name.trim();

    const fieldErrors = validateLogByField(payload, { requireDate: true });
    // Plant selection is UI state (which mode is active, whether a plant is
    // picked) the server can't express; show that message over the shared
    // validator's plant-name wording when neither is set.
    const name = plantMode === 'existing' ? selectedPlant?.name : form.plant_name.trim();
    if (!name) fieldErrors.plant = 'Please select or name a plant';
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      emitSafe(BUD_EVENTS.SAVE_ERROR, { kind: 'log' });
      return;
    }
    setErrors({});
    setIsSubmitting(true);

    try {
      let config;
      let body = payload;
      if (form.image) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => {
          if (v === undefined) return;
          if (k === 'doses') { if (v.length > 0) fd.append('doses', JSON.stringify(v)); return; }
          fd.append(k, v);
        });
        fd.append('image', form.image);
        body = fd;
        config = { headers: { 'Content-Type': 'multipart/form-data' } };
      }
      const created = await createLog(body, config);
      toast.success('Growth log added');
      emitSafe(BUD_EVENTS.SAVE_OK, { kind: 'log' });
      clearDraft();
      setErrors({});
      // Keep the same plant selected for fast repeat entry.
      setForm(blankForm());
      if (plantMode === 'new' && created?.plant_id) {
        setPlantMode('existing');
        setSelectedPlantId(created.plant_id);
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to add log'));
      emitSafe(BUD_EVENTS.SAVE_ERROR, { kind: 'log' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls = (hasErr) =>
    `w-full px-3 py-2 ${colors.bgAccent} border ${hasErr ? 'border-red-500' : colors.border} rounded-lg ${colors.text} focus:outline-none focus:ring-2 ${hasErr ? 'focus:ring-red-500' : 'focus:ring-blue-500'} transition-colors`;

  return (
    <div className={`${colors.bgSecondary} rounded-xl p-6 shadow-lg ${colors.border} border transition-colors duration-300`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className={`text-2xl font-bold ${colors.primary}`}>📝 Add Growth Log</h2>
        {isDirty && (
          <span className={`flex items-center gap-1 text-sm ${colors.textMuted}`}>
            <AlertCircle size={16} className="text-yellow-500" /> Draft saved
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Plant selection */}
        <div>
          <label className={`block text-sm font-medium ${colors.text} mb-2`}>Plant</label>
          <div className="flex gap-2 mb-2">
            <button type="button" onClick={() => setPlantMode('existing')}
              className={`px-3 py-1.5 text-sm rounded-lg border ${colors.border} ${plantMode === 'existing' ? `${colors.primaryBg} text-white` : `${colors.bgAccent} ${colors.text}`}`}>
              Existing
            </button>
            <button type="button" onClick={() => setPlantMode('new')}
              className={`px-3 py-1.5 text-sm rounded-lg border ${colors.border} ${plantMode === 'new' ? `${colors.primaryBg} text-white` : `${colors.bgAccent} ${colors.text}`}`}>
              + New plant
            </button>
          </div>
          {plantMode === 'existing' ? (
            <select aria-label="Plant" value={selectedPlantId} onChange={(e) => { setSelectedPlantId(e.target.value); setIsDirty(true); }} onFocus={() => emitSafe(BUD_EVENTS.FORM_FOCUS, {})} className={inputCls(errors.plant)}>
              <option value="">Select a plant…</option>
              {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          ) : (
            <input name="plant_name" aria-label="New plant name" value={form.plant_name} onChange={handleChange} onFocus={() => emitSafe(BUD_EVENTS.FORM_FOCUS, {})}
              placeholder="e.g., Tomato Plant #1" className={inputCls(errors.plant)} />
          )}
          {errors.plant && <p className="text-red-500 text-sm mt-1">{errors.plant}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Date" colors={colors}>
            <input name="date" type="date" value={form.date} onChange={handleChange} className={inputCls()} />
          </Field>
          <Field label="Growth stage" colors={colors}>
            <select name="growth_stage" value={form.growth_stage} onChange={handleChange} className={inputCls()}>
              <option value="">Auto (from height)</option>
              {stageOptions.map((s) => <option key={s} value={s}>{stageLabel(s)}</option>)}
            </select>
          </Field>
        </div>

        {/* Height with steppers */}
        <Field label={`Height (${lengthUnitLabel(lengthUnit)})`} colors={colors} error={errors.height}>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Decrease height" onClick={() => adjustHeight(-0.5)} className={`${colors.bgAccent} border ${colors.border} rounded-lg p-2`}>
              <Minus size={16} className={colors.text} />
            </button>
            <input name="height" aria-label="Height" type="number" step="0.1" min="0" value={form.height} onChange={handleChange}
              placeholder="0.0" className={`flex-1 text-center font-mono ${inputCls(errors.height)}`} />
            <button type="button" aria-label="Increase height" onClick={() => adjustHeight(0.5)} className={`${colors.bgAccent} border ${colors.border} rounded-lg p-2`}>
              <Plus size={16} className={colors.text} />
            </button>
          </div>
        </Field>

        {/* Measurements */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="pH" colors={colors} error={errors.ph}><input name="ph" type="number" step="0.1" value={form.ph} onChange={handleChange} placeholder="5.5–6.5" className={inputCls(errors.ph)} /></Field>
          <Field label="EC" colors={colors} error={errors.ec}><input name="ec" type="number" step="0.1" value={form.ec} onChange={handleChange} placeholder="1.2" className={inputCls(errors.ec)} /></Field>
          <Field label="PPM" colors={colors} error={errors.ppm}><input name="ppm" type="number" step="10" value={form.ppm} onChange={handleChange} placeholder="600" className={inputCls(errors.ppm)} /></Field>
          <Field label={`Water temp (${tempUnitLabel(tempUnit)})`} colors={colors} error={errors.water_temp}><input name="water_temp" type="number" step="0.1" value={form.water_temp} onChange={handleChange} className={inputCls(errors.water_temp)} /></Field>
          <Field label={`Air temp (${tempUnitLabel(tempUnit)})`} colors={colors} error={errors.air_temp}><input name="air_temp" type="number" step="0.1" value={form.air_temp} onChange={handleChange} className={inputCls(errors.air_temp)} /></Field>
          <Field label="Humidity (%)" colors={colors} error={errors.humidity}><input name="humidity" type="number" step="1" value={form.humidity} onChange={handleChange} className={inputCls(errors.humidity)} /></Field>
          <Field label="Light (hrs)" colors={colors} error={errors.light_hours}><input name="light_hours" type="number" step="0.5" value={form.light_hours} onChange={handleChange} className={inputCls(errors.light_hours)} /></Field>
          <Field label={`Reservoir (${volumeUnitLabel(volumeUnit)})`} colors={colors} error={errors.reservoir_volume}><input name="reservoir_volume" type="number" step="1" value={form.reservoir_volume} onChange={handleChange} className={inputCls(errors.reservoir_volume)} /></Field>
        </div>

        <Field label="Nutrients used" colors={colors} error={errors.nutrients}>
          <input name="nutrients" value={form.nutrients} onChange={handleChange}
            placeholder="e.g., General Hydroponics Flora Series, 5ml/L" className={inputCls(errors.nutrients)} />
        </Field>

        <div>
          <label className={`block text-sm font-medium ${colors.text} mb-1`}>Doses</label>
          <DosesEditor doses={form.doses} onChange={(doses) => update({ doses })} colors={colors} error={errors.doses} />
        </div>

        <Field label="Notes" colors={colors}>
          <textarea name="notes" value={form.notes} onChange={handleChange} rows="3" maxLength={1000}
            placeholder="Observations, changes…" className={`${inputCls()} resize-none`} />
        </Field>

        <Field label="Image (optional)" colors={colors}>
          <input type="file" name="image" accept="image/*" onChange={handleChange}
            className={`${inputCls()} file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700`} />
        </Field>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={isSubmitting}
            className={`flex-1 ${colors.primaryBg} text-white px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50`}>
            <Save size={16} /> {isSubmitting ? 'Adding…' : 'Add Growth Log'}
          </button>
          {isDirty && (
            <button type="button" onClick={() => { setForm(blankForm()); clearDraft(); setErrors({}); }}
              className={`px-6 py-3 ${colors.bgAccent} ${colors.text} rounded-lg font-medium border ${colors.border}`}>
              Clear
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

// The label is bound to its control by id so screen readers (and axe) see a
// named input; a wrapper child (e.g. the height stepper row) is left alone and
// its input carries its own aria-label.
const Field = ({ label, error, colors, children }) => {
  const id = useId();
  const child = React.isValidElement(children) && children.type !== 'div'
    ? React.cloneElement(children, { id: children.props.id || id })
    : children;
  const bound = child !== children;
  return (
    <div>
      <label htmlFor={bound ? id : undefined} className={`block text-sm font-medium ${colors.text} mb-1`}>{label}</label>
      {child}
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
};

// Nutrient dosing recipe: up to DOSES_MAX rows of a name + ml/L strength.
// Shared between AddLogForm and LogViewer's edit form so the row shape and
// bounds (DOSES_MAX) are defined once.
export const DosesEditor = ({ doses, onChange, colors, error }) => {
  const updateRow = (i, patch) => {
    onChange(doses.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  };
  const removeRow = (i) => onChange(doses.filter((_, idx) => idx !== i));
  const addRow = () => onChange([...doses, { name: '', ml_per_l: '' }]);
  const rowCls = `w-full px-3 py-2 ${colors.bgAccent} border ${colors.border} rounded-lg ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors`;

  return (
    <div className="space-y-2">
      {doses.map((dose, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            aria-label="Dose name"
            value={dose.name}
            onChange={(e) => updateRow(i, { name: e.target.value })}
            placeholder="e.g., Part A"
            className={`flex-1 ${rowCls}`}
          />
          <input
            aria-label="Dose ml/L"
            type="number"
            step="0.1"
            min="0"
            value={dose.ml_per_l}
            onChange={(e) => updateRow(i, { ml_per_l: e.target.value })}
            placeholder="ml/L"
            className={`w-24 ${rowCls}`}
          />
          <button type="button" aria-label="Remove dose" onClick={() => removeRow(i)}
            className={`${colors.bgAccent} border ${colors.border} rounded-lg p-2`}>
            <X size={16} className={colors.text} />
          </button>
        </div>
      ))}
      <button type="button" onClick={addRow} disabled={doses.length >= DOSES_MAX}
        className={`${colors.bgAccent} ${colors.text} border ${colors.border} rounded-lg px-3 py-1.5 text-sm disabled:opacity-50 flex items-center gap-1`}>
        <Plus size={14} /> Add dose
      </button>
      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
};

export default AddLogForm;
