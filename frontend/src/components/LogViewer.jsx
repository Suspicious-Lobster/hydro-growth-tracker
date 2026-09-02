import React, { useState } from 'react';
import { Edit3, Save, X, Calendar, Camera, FileText, Trash2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAppData } from '../contexts/AppDataContext';
import { useToast } from '../contexts/ToastContext';
import { resolveImageUrl, apiErrorMessage } from '../api/api';
import {
  formatDate, formatDateTime, formatLength, formatTemp, formatVolume,
  toCm, fromCm, toCelsius, fromCelsius, toLiters, fromLiters,
  lengthUnitLabel, tempUnitLabel, volumeUnitLabel,
} from '../utils/format';
import { dayKey } from '../utils/dates';
import { stageLabel, getProfileStages } from '../data/recommendations';
import { GROWTH_STAGES } from '../data/plantKnowledge';
import ConfirmDialog from './ui/ConfirmDialog';

// Round a display-unit value to a sane number of decimals when prefilling an
// input, so e.g. 10cm shown in inches doesn't render as 3.9370078740157...
const round2 = (n) => Math.round(n * 100) / 100;

// A field left blank in the edit form must clear the stored value (send
// null), never silently keep the old one (which would happen if we sent
// undefined or omitted the key).
const numOrNull = (v) => (v === '' || v === null || v === undefined ? null : parseFloat(v));

const LogViewer = () => {
  const { colors } = useTheme();
  const { logs, plants, settings, updateLog, deleteLog } = useAppData();
  const toast = useToast();
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const { length: lengthUnit, temp: tempUnit, volume: volumeUnit } = settings.units;

  const startEditing = (log) => {
    setEditingId(log.id);
    setEditForm({
      plant_id: log.plant_id != null ? String(log.plant_id) : '',
      date: log.date || '',
      // Stored canonically; show in the active display units.
      height: log.height == null ? '' : round2(fromCm(parseFloat(log.height), lengthUnit)),
      growth_stage: log.growth_stage || '',
      ph: log.ph ?? '',
      ec: log.ec ?? '',
      ppm: log.ppm ?? '',
      water_temp: log.water_temp == null ? '' : round2(fromCelsius(parseFloat(log.water_temp), tempUnit)),
      air_temp: log.air_temp == null ? '' : round2(fromCelsius(parseFloat(log.air_temp), tempUnit)),
      humidity: log.humidity ?? '',
      light_hours: log.light_hours ?? '',
      reservoir_volume: log.reservoir_volume == null ? '' : round2(fromLiters(parseFloat(log.reservoir_volume), volumeUnit)),
      nutrients: log.nutrients || '',
      notes: log.notes || '',
    });
  };

  const cancelEditing = () => { setEditingId(null); setEditForm({}); };

  const selectedPlant = plants.find((p) => String(p.id) === String(editForm.plant_id));
  const stageOptions = selectedPlant?.species ? getProfileStages(selectedPlant.species) : Object.values(GROWTH_STAGES);

  const saveLog = async (logId) => {
    if (!editForm.plant_id) { toast.error('Select a plant'); return; }
    if (editForm.height === '' || parseFloat(editForm.height) < 0) { toast.error('Height must be a positive number'); return; }
    if (!editForm.nutrients.trim()) { toast.error('Nutrients are required'); return; }
    try {
      await updateLog(logId, {
        // Plant is chosen by id, never re-sent as free text — a typo'd
        // plant_name used to make the server silently fork a new plant.
        plant_id: Number(editForm.plant_id),
        date: editForm.date,
        // Convert the display-unit input back to canonical cm/°C/liters for storage.
        height: toCm(parseFloat(editForm.height), lengthUnit),
        growth_stage: editForm.growth_stage || null,
        ph: numOrNull(editForm.ph),
        ec: numOrNull(editForm.ec),
        ppm: numOrNull(editForm.ppm),
        water_temp: editForm.water_temp === '' ? null : toCelsius(parseFloat(editForm.water_temp), tempUnit),
        air_temp: editForm.air_temp === '' ? null : toCelsius(parseFloat(editForm.air_temp), tempUnit),
        humidity: numOrNull(editForm.humidity),
        light_hours: numOrNull(editForm.light_hours),
        reservoir_volume: editForm.reservoir_volume === '' ? null : toLiters(parseFloat(editForm.reservoir_volume), volumeUnit),
        nutrients: editForm.nutrients.trim(),
        notes: editForm.notes,
      });
      toast.success('Log updated');
      cancelEditing();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to update log'));
    }
  };

  const removeLog = (log) => setPendingDelete(log);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteLog(pendingDelete.id);
      toast.success('Log deleted');
      setPendingDelete(null);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to delete log'));
    } finally {
      setDeleting(false);
    }
  };

  const inputCls = `w-full px-3 py-2 ${colors.bgAccent} border ${colors.border} rounded-lg ${colors.text}`;

  return (
    <div className={`${colors.bgSecondary} rounded-xl shadow-lg w-full ${colors.border} border`}>
      <div className={`p-6 border-b ${colors.border}`}>
        <div className="flex items-center gap-3">
          <Edit3 className="text-green-400" size={24} />
          <h2 className={`text-2xl font-bold ${colors.text}`}>View & Edit Logs</h2>
        </div>
        <p className={`${colors.textMuted} mt-2`}>Total logs: {logs.length}</p>
      </div>

      <div className="p-6">
        {logs.length === 0 ? (
          <div className={`text-center ${colors.textMuted} py-12`}>
            <FileText size={48} className="mx-auto mb-4 opacity-50" />
            <p>No logs found. Add your first growth log!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <div key={log.id} className={`${colors.bgAccent} rounded-lg p-4 border ${colors.border}`}>
                {editingId === log.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className={`block text-sm ${colors.text} mb-1`}>Plant</label>
                        <select value={editForm.plant_id} onChange={(e) => setEditForm({ ...editForm, plant_id: e.target.value })} className={inputCls}>
                          <option value="">Select plant…</option>
                          {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <LabeledInput label="Date" colors={colors} cls={inputCls} type="date" value={editForm.date} onChange={(v) => setEditForm({ ...editForm, date: v })} />
                      <div>
                        <label className={`block text-sm ${colors.text} mb-1`}>Growth stage</label>
                        <select value={editForm.growth_stage} onChange={(e) => setEditForm({ ...editForm, growth_stage: e.target.value })} className={inputCls}>
                          <option value="">Not set</option>
                          {stageOptions.map((s) => <option key={s} value={s}>{stageLabel(s)}</option>)}
                        </select>
                      </div>
                      <LabeledInput label={`Height (${lengthUnitLabel(lengthUnit)})`} colors={colors} cls={inputCls} type="number" value={editForm.height} onChange={(v) => setEditForm({ ...editForm, height: v })} />
                      <LabeledInput label="Nutrients" colors={colors} cls={inputCls} value={editForm.nutrients} onChange={(v) => setEditForm({ ...editForm, nutrients: v })} />
                      <LabeledInput label="pH" colors={colors} cls={inputCls} type="number" value={editForm.ph} onChange={(v) => setEditForm({ ...editForm, ph: v })} />
                      <LabeledInput label="EC" colors={colors} cls={inputCls} type="number" value={editForm.ec} onChange={(v) => setEditForm({ ...editForm, ec: v })} />
                      <LabeledInput label="PPM" colors={colors} cls={inputCls} type="number" value={editForm.ppm} onChange={(v) => setEditForm({ ...editForm, ppm: v })} />
                      <LabeledInput label={`Water temp (${tempUnitLabel(tempUnit)})`} colors={colors} cls={inputCls} type="number" value={editForm.water_temp} onChange={(v) => setEditForm({ ...editForm, water_temp: v })} />
                      <LabeledInput label={`Air temp (${tempUnitLabel(tempUnit)})`} colors={colors} cls={inputCls} type="number" value={editForm.air_temp} onChange={(v) => setEditForm({ ...editForm, air_temp: v })} />
                      <LabeledInput label="Humidity (%)" colors={colors} cls={inputCls} type="number" value={editForm.humidity} onChange={(v) => setEditForm({ ...editForm, humidity: v })} />
                      <LabeledInput label="Light (hours)" colors={colors} cls={inputCls} type="number" value={editForm.light_hours} onChange={(v) => setEditForm({ ...editForm, light_hours: v })} />
                      <LabeledInput label={`Reservoir (${volumeUnitLabel(volumeUnit)})`} colors={colors} cls={inputCls} type="number" value={editForm.reservoir_volume} onChange={(v) => setEditForm({ ...editForm, reservoir_volume: v })} />
                    </div>
                    <div>
                      <label className={`block text-sm ${colors.text} mb-1`}>Notes</label>
                      <textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className={inputCls} rows={2} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveLog(log.id)} className={`px-4 py-2 ${colors.primaryBg} text-white rounded-lg text-sm flex items-center gap-2`}>
                        <Save size={16} /> Save
                      </button>
                      <button onClick={cancelEditing} className={`px-4 py-2 ${colors.bgSecondary} ${colors.text} rounded-lg text-sm border ${colors.border} flex items-center gap-2`}>
                        <X size={16} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className={`text-lg font-semibold ${colors.text}`}>{log.plant_name}</h3>
                        <div className={`flex items-center gap-4 text-sm ${colors.textMuted} mt-1`}>
                          <span className="flex items-center gap-1"><Calendar size={14} /> {formatDate(log.date ?? log.created_at)}</span>
                          {log.growth_stage && <span>{stageLabel(log.growth_stage)}</span>}
                          {log.image_url && <span className="flex items-center gap-1"><Camera size={14} /> Photo</span>}
                        </div>
                        {/* A backdated entry (date far from when it was actually typed in) gets
                            a small caption with the real insert time, so the two never look like
                            the same fact silently overwritten. */}
                        {log.date && log.created_at && dayKey(log.date) !== dayKey(log.created_at) && (
                          <div className={`text-xs ${colors.textMuted} italic mt-0.5`}>logged {formatDateTime(log.created_at)}</div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => startEditing(log)} className={`${colors.textMuted} hover:${colors.primary} p-2`} title="Edit"><Edit3 size={18} /></button>
                        <button onClick={() => removeLog(log)} className={`${colors.textMuted} hover:text-red-500 p-2`} title="Delete"><Trash2 size={18} /></button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      <Cell colors={colors} label="Height" value={formatLength(log.height, lengthUnit)} />
                      <Cell colors={colors} label="pH" value={log.ph ?? '—'} />
                      <Cell colors={colors} label="EC" value={log.ec ?? '—'} />
                      <Cell colors={colors} label="PPM" value={log.ppm ?? '—'} />
                      <Cell colors={colors} label="Water" value={log.water_temp != null ? formatTemp(log.water_temp, tempUnit) : '—'} />
                      <Cell colors={colors} label="Air" value={log.air_temp != null ? formatTemp(log.air_temp, tempUnit) : '—'} />
                      <Cell colors={colors} label="Humidity" value={log.humidity != null ? `${log.humidity}%` : '—'} />
                      <Cell colors={colors} label="Light" value={log.light_hours != null ? `${log.light_hours} h` : '—'} />
                      <Cell colors={colors} label="Reservoir" value={log.reservoir_volume != null ? formatVolume(log.reservoir_volume, volumeUnit) : '—'} />
                    </div>

                    <div className={`text-sm ${colors.textMuted} mb-2`}><strong>Nutrients:</strong> {log.nutrients || 'Not specified'}</div>
                    {log.notes && <div className={`${colors.bgSecondary} p-3 rounded text-sm ${colors.text} italic`}>{log.notes}</div>}
                    {log.image_url && (
                      <img src={resolveImageUrl(log.image_url)} alt={`${log.plant_name} growth`} className="max-w-xs rounded-lg shadow-md mt-3" />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete log"
          message="Delete this log?"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
};

const Cell = ({ colors, label, value }) => (
  <div className={`${colors.bgSecondary} p-2 rounded`}>
    <span className={`text-xs ${colors.textMuted}`}>{label}</span>
    <div className={`font-semibold ${colors.text}`}>{value}</div>
  </div>
);

const LabeledInput = ({ label, colors, cls, value, onChange, type = 'text' }) => (
  <div>
    <label className={`block text-sm ${colors.text} mb-1`}>{label}</label>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
  </div>
);

export default LogViewer;
