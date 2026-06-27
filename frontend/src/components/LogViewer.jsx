import React, { useState } from 'react';
import { Edit3, Save, X, Calendar, Camera, FileText, Trash2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAppData } from '../contexts/AppDataContext';
import { useToast } from '../contexts/ToastContext';
import { resolveImageUrl, apiErrorMessage } from '../api/api';
import { formatDate, formatLength, formatTemp } from '../utils/format';
import { stageLabel } from '../data/recommendations';

const LogViewer = () => {
  const { colors } = useTheme();
  const { logs, settings, updateLog, deleteLog } = useAppData();
  const toast = useToast();
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const { length: lengthUnit, temp: tempUnit } = settings.units;

  const startEditing = (log) => {
    setEditingId(log.id);
    setEditForm({
      plant_name: log.plant_name || '',
      height: log.height ?? '',
      nutrients: log.nutrients || '',
      ph: log.ph ?? '',
      ec: log.ec ?? '',
      notes: log.notes || '',
    });
  };

  const cancelEditing = () => { setEditingId(null); setEditForm({}); };

  const saveLog = async (logId) => {
    if (!editForm.plant_name.trim()) { toast.error('Plant name is required'); return; }
    if (editForm.height === '' || parseFloat(editForm.height) < 0) { toast.error('Height must be a positive number'); return; }
    if (!editForm.nutrients.trim()) { toast.error('Nutrients are required'); return; }
    try {
      await updateLog(logId, {
        plant_name: editForm.plant_name.trim(),
        height: parseFloat(editForm.height),
        nutrients: editForm.nutrients.trim(),
        ph: editForm.ph === '' ? undefined : parseFloat(editForm.ph),
        ec: editForm.ec === '' ? undefined : parseFloat(editForm.ec),
        notes: editForm.notes,
      });
      toast.success('Log updated');
      cancelEditing();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to update log'));
    }
  };

  const removeLog = async (logId) => {
    if (!window.confirm('Delete this log?')) return;
    try {
      await deleteLog(logId);
      toast.success('Log deleted');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to delete log'));
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
                      <LabeledInput label="Plant" colors={colors} cls={inputCls} value={editForm.plant_name} onChange={(v) => setEditForm({ ...editForm, plant_name: v })} />
                      <LabeledInput label={`Height (${lengthUnit})`} colors={colors} cls={inputCls} type="number" value={editForm.height} onChange={(v) => setEditForm({ ...editForm, height: v })} />
                      <LabeledInput label="Nutrients" colors={colors} cls={inputCls} value={editForm.nutrients} onChange={(v) => setEditForm({ ...editForm, nutrients: v })} />
                      <LabeledInput label="pH" colors={colors} cls={inputCls} type="number" value={editForm.ph} onChange={(v) => setEditForm({ ...editForm, ph: v })} />
                      <LabeledInput label="EC" colors={colors} cls={inputCls} type="number" value={editForm.ec} onChange={(v) => setEditForm({ ...editForm, ec: v })} />
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
                          <span className="flex items-center gap-1"><Calendar size={14} /> {formatDate(log.created_at)}</span>
                          {log.growth_stage && <span>{stageLabel(log.growth_stage)}</span>}
                          {log.image_url && <span className="flex items-center gap-1"><Camera size={14} /> Photo</span>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => startEditing(log)} className={`${colors.textMuted} hover:${colors.primary} p-2`} title="Edit"><Edit3 size={18} /></button>
                        <button onClick={() => removeLog(log.id)} className={`${colors.textMuted} hover:text-red-500 p-2`} title="Delete"><Trash2 size={18} /></button>
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
