import React, { useState } from 'react';
import { Save } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAppData } from '../contexts/AppDataContext';
import { useToast } from '../contexts/ToastContext';
import { apiErrorMessage } from '../api/api';
import { SPECIES_OPTIONS } from '../data/recommendations';

const SettingsPanel = () => {
  const { colors } = useTheme();
  const { settings, updateSettings } = useAppData();
  const toast = useToast();

  const [form, setForm] = useState({
    length: settings.units.length,
    volume: settings.units.volume,
    temp: settings.units.temp,
    ppm_scale: settings.ppm_scale,
    default_species: settings.default_species || '',
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await updateSettings({
        units: { length: form.length, volume: form.volume, temp: form.temp },
        ppm_scale: Number(form.ppm_scale),
        default_species: form.default_species || null,
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

      <button onClick={save} disabled={busy} className={`${colors.primaryBg} text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50`}>
        <Save size={16} /> {busy ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  );
};

const Field = ({ label, colors, children }) => (
  <div>
    <label className={`block text-sm font-medium ${colors.text} mb-1`}>{label}</label>
    {children}
  </div>
);

export default SettingsPanel;
