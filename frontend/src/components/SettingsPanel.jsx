import React, { useState, useId } from 'react';
import { Save, Plus, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAppData } from '../contexts/AppDataContext';
import { useAssistant } from '../contexts/AssistantContext';
import { useToast } from '../contexts/ToastContext';
import { apiErrorMessage } from '../api/api';
import { SPECIES_OPTIONS } from '../data/recommendations';
import BackupRestore from './BackupRestore';
import AboutDialog from './AboutDialog';

const SettingsPanel = () => {
  const { colors } = useTheme();
  const { settings, updateSettings } = useAppData();
  const { effectsEnabled, muted, soundEnabled, remindersEnabled, voice, toggleEffects, setMuted, setSoundEnabled, setRemindersEnabled, setVoice, resetDismissed, startTour } = useAssistant();
  const toast = useToast();
  const [showAbout, setShowAbout] = useState(false);

  const [form, setForm] = useState({
    length: settings.units.length,
    volume: settings.units.volume,
    temp: settings.units.temp,
    ppm_scale: settings.ppm_scale,
    default_species: settings.default_species || '',
    // MR-53: price per liter of each nutrient product, for the cost card.
    nutrient_prices: (settings.nutrient_prices || []).map((p) => ({ name: p.name, price_per_liter: String(p.price_per_liter) })),
  });
  const [busy, setBusy] = useState(false);

  const updatePrice = (i, patch) => setForm({ ...form, nutrient_prices: form.nutrient_prices.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) });
  const removePrice = (i) => setForm({ ...form, nutrient_prices: form.nutrient_prices.filter((_, idx) => idx !== i) });
  const addPrice = () => setForm({ ...form, nutrient_prices: [...form.nutrient_prices, { name: '', price_per_liter: '' }] });

  const save = async () => {
    setBusy(true);
    try {
      await updateSettings({
        units: { length: form.length, volume: form.volume, temp: form.temp },
        ppm_scale: Number(form.ppm_scale),
        default_species: form.default_species || null,
        nutrient_prices: form.nutrient_prices
          .filter((p) => p.name.trim())
          .map((p) => ({ name: p.name.trim(), price_per_liter: parseFloat(p.price_per_liter) || 0 })),
      });
      toast.success('Settings saved');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to save settings'));
    } finally {
      setBusy(false);
    }
  };

  const selectCls = `w-full px-3 py-2 ${colors.bgAccent} border ${colors.border} rounded-lg ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500`;

  return (
    <div className="space-y-6">
    <div className={`${colors.bgSecondary} rounded-xl shadow-lg p-6 ${colors.border} border space-y-6`}>
      <div>
        <h2 className={`text-2xl font-bold ${colors.primary}`}>⚙️ Settings</h2>
        <p className={colors.textMuted}>Display units and preferences. Data is stored canonically and converted for display.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Length unit" colors={colors}>
          <select value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })} className={selectCls}>
            <option value="cm">Centimeters (cm)</option>
            <option value="in">Inches (in)</option>
          </select>
        </Field>
        <Field label="Volume unit" colors={colors}>
          <select value={form.volume} onChange={(e) => setForm({ ...form, volume: e.target.value })} className={selectCls}>
            <option value="liters">Liters (L)</option>
            <option value="gallons">Gallons (gal)</option>
          </select>
        </Field>
        <Field label="Temperature unit" colors={colors}>
          <select value={form.temp} onChange={(e) => setForm({ ...form, temp: e.target.value })} className={selectCls}>
            <option value="C">Celsius (°C)</option>
            <option value="F">Fahrenheit (°F)</option>
          </select>
        </Field>
        <Field label="PPM scale" colors={colors}>
          <select value={form.ppm_scale} onChange={(e) => setForm({ ...form, ppm_scale: e.target.value })} className={selectCls}>
            <option value={500}>500 (US / Hanna)</option>
            <option value={700}>700 (EU / Truncheon)</option>
          </select>
        </Field>
        <Field label="Default species" colors={colors}>
          <select value={form.default_species} onChange={(e) => setForm({ ...form, default_species: e.target.value })} className={selectCls}>
            <option value="">None</option>
            {SPECIES_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>

      {/* Nutrient prices (MR-53): what a liter of each product costs, in your
          own currency, so the plant view can total what a grow has used. */}
      <div>
        <div className={`font-medium ${colors.text}`}>Nutrient prices</div>
        <div className={`text-sm ${colors.textMuted} mb-2`}>Price per liter of each product you dose. Names must match the dose names on your logs.</div>
        <div className="space-y-2">
          {form.nutrient_prices.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <input aria-label="Nutrient name" value={p.name} onChange={(e) => updatePrice(i, { name: e.target.value })} placeholder="e.g., Part A" className={`flex-1 ${selectCls}`} />
              <input aria-label="Price per liter" type="number" step="0.01" min="0" value={p.price_per_liter} onChange={(e) => updatePrice(i, { price_per_liter: e.target.value })} placeholder="per liter" className={`w-32 ${selectCls}`} />
              <button type="button" aria-label="Remove price" onClick={() => removePrice(i)} className={`${colors.bgAccent} border ${colors.border} rounded-lg p-2`}>
                <X size={16} className={colors.text} />
              </button>
            </div>
          ))}
          <button type="button" onClick={addPrice} disabled={form.nutrient_prices.length >= 20}
            className={`${colors.bgAccent} ${colors.text} border ${colors.border} rounded-lg px-3 py-1.5 text-sm disabled:opacity-50 flex items-center gap-1`}>
            <Plus size={14} /> Add nutrient price
          </button>
        </div>
      </div>

      <button onClick={save} disabled={busy} className={`${colors.primaryBg} text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50`}>
        <Save size={16} /> {busy ? 'Saving…' : 'Save Settings'}
      </button>
    </div>

    {/* Fun & effects — saved instantly to this device (no Save button needed). */}
    <div className={`${colors.bgSecondary} rounded-xl shadow-lg p-6 ${colors.border} border space-y-4`}>
      <div>
        <h2 className={`text-2xl font-bold ${colors.primary}`}>🌿 Fun &amp; Effects</h2>
        <p className={colors.textMuted}>Bud the assistant and the app's ambient animations. Saved on this device.</p>
      </div>
      <Toggle colors={colors} label="Animated effects" description="Swaying leaves and mascot animations." checked={effectsEnabled} onChange={toggleEffects} />
      <Toggle colors={colors} label="Bud the assistant" description="Proactive grow tips. Turn off to mute pop-ups." checked={!muted} onChange={() => setMuted(!muted)} />
      <Toggle colors={colors} label="Sound effects" description="Tiny pops, snores, and lighter flicks from Bud. Quiet by design." checked={soundEnabled} onChange={() => setSoundEnabled(!soundEnabled)} />
      <Toggle colors={colors} label="Feeding reminders" description="Desktop notification when a feeding is due." checked={remindersEnabled !== false} onChange={() => setRemindersEnabled && setRemindersEnabled(!(remindersEnabled !== false))} />
      <Field label="Bud's voice" colors={colors}>
        <select
          aria-label="Bud's voice"
          value={voice || 'towelie'}
          onChange={(e) => setVoice && setVoice(e.target.value)}
          className={selectCls}
        >
          <option value="towelie">Towelie (spacey)</option>
          <option value="clean">Clean</option>
        </select>
      </Field>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { resetDismissed(); toast.success('Tips reset — Bud will share them again'); }}
          className={`${colors.bgAccent} ${colors.text} border ${colors.border} px-4 py-2 rounded-lg text-sm font-medium`}
        >
          Reset dismissed tips
        </button>
        <button
          onClick={() => { startTour(); toast.success('Bud will show you around 🌿'); }}
          className={`${colors.bgAccent} ${colors.text} border ${colors.border} px-4 py-2 rounded-lg text-sm font-medium`}
        >
          Replay the welcome tour
        </button>
        <button
          onClick={() => setShowAbout(true)}
          className={`${colors.bgAccent} ${colors.text} border ${colors.border} px-4 py-2 rounded-lg text-sm font-medium`}
        >
          About
        </button>
      </div>
    </div>

    <BackupRestore />
    {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
    </div>
  );
};

const Toggle = ({ colors, label, description, checked, onChange }) => (
  <div className="flex items-center justify-between gap-4">
    <div>
      <div className={`font-medium ${colors.text}`}>{label}</div>
      {description && <div className={`text-sm ${colors.textMuted}`}>{description}</div>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative w-12 h-6 rounded-full flex-shrink-0 transition-colors ${checked ? colors.primaryBg : colors.bgAccent} border ${colors.border}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-6' : ''}`} />
    </button>
  </div>
);

// Label bound to its control by id, so the select has an accessible name (MR-28).
const Field = ({ label, colors, children }) => {
  const id = useId();
  const child = React.isValidElement(children) ? React.cloneElement(children, { id: children.props.id || id }) : children;
  return (
    <div>
      <label htmlFor={id} className={`block text-sm font-medium ${colors.text} mb-1`}>{label}</label>
      {child}
    </div>
  );
};

export default SettingsPanel;
