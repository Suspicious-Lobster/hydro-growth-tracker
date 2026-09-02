import React, { useState } from 'react';
import { Calendar, Droplets, Eye, AlertTriangle, CheckCircle, Clock, Calculator, Pencil, Trash2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAppData } from '../contexts/AppDataContext';
import { useToast } from '../contexts/ToastContext';
import { apiErrorMessage } from '../api/api';
import Modal from './ui/Modal';
import ConfirmDialog from './ui/ConfirmDialog';
import NutrientCalculator from './NutrientCalculator';
import FeedingScheduleCalendarExport from './FeedingScheduleCalendarExport';
import { latestLog } from '../utils/stats';
import { formatDate } from '../utils/format';
import { feedingStatus, FREQUENCY_LABELS } from '../utils/feeding';
import { inferStage, stageLabel, getStageGuidance } from '../data/recommendations';

const emptyForm = (plantId = '') => ({ plant_id: plantId, nutrient_type: '', ec_level: '', frequency: 'daily', custom_interval_days: '', notes: '' });

const FeedingSchedule = () => {
  const { colors } = useTheme();
  const { plants, schedules, getPlantLogs, createSchedule, updateSchedule, deleteSchedule, markFed } = useAppData();
  const toast = useToast();

  const [editing, setEditing] = useState(null); // null | 'new' | schedule
  const [form, setForm] = useState(emptyForm());
  const [calculatorStage, setCalculatorStage] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const inputCls = `w-full px-3 py-2 ${colors.bgAccent} border ${colors.border} rounded-lg ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500`;

  /* ---- recommendations per plant (species + stage aware) ---- */
  const recommendationFor = (plant) => {
    const logs = getPlantLogs(plant);
    const latest = latestLog(logs);
    const stage = inferStage(plant.species, latest?.height, latest?.growth_stage) || plant.target_stage;
    if (!stage) return null;
    return { stage, guidance: getStageGuidance(plant.species, stage) };
  };

  /* ---- due tasks ---- */
  const dueTasks = schedules
    .filter((s) => s.active !== false)
    .map((s) => ({ schedule: s, status: feedingStatus(s) }))
    .filter((t) => t.status.due)
    .sort((a, b) => a.status.daysUntil - b.status.daysUntil);

  const openNew = () => { setForm(emptyForm(plants[0]?.id || '')); setEditing('new'); };
  const openEdit = (s) => {
    setForm({ plant_id: s.plant_id || '', nutrient_type: s.nutrient_type, ec_level: s.ec_level, frequency: s.frequency, custom_interval_days: s.custom_interval_days || '', notes: s.notes || '' });
    setEditing(s);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.plant_id) { toast.error('Select a plant'); return; }
    if (!form.nutrient_type.trim()) { toast.error('Nutrient type is required'); return; }
    setBusy(true);
    const payload = { ...form, plant_id: Number(form.plant_id), custom_interval_days: form.frequency === 'custom' ? Number(form.custom_interval_days) : null };
    try {
      if (editing === 'new') { await createSchedule(payload); toast.success('Schedule added'); }
      else { await updateSchedule(editing.id, payload); toast.success('Schedule updated'); }
      setEditing(null);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to save schedule'));
    } finally {
      setBusy(false);
    }
  };

  const doMarkFed = async (s) => {
    try { await markFed(s.id); toast.success(`Marked "${s.plant_name}" as fed`); }
    catch (err) { toast.error(apiErrorMessage(err)); }
  };

  const doDelete = (s) => setPendingDelete(s);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteSchedule(pendingDelete.id);
      toast.success('Schedule deleted');
      setPendingDelete(null);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className={`text-3xl font-bold ${colors.primary}`}>🌿 Feeding & Care</h2>
          <p className={colors.textMuted}>Reminders and species-aware recommendations.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowCalendar(true)} className={`${colors.bgAccent} ${colors.text} px-4 py-2 rounded-lg font-medium border ${colors.border} flex items-center gap-2`}>
            <Calendar size={16} /> Export Calendar
          </button>
          <button onClick={openNew} className={`${colors.primaryBg} text-white px-4 py-2 rounded-lg font-medium`}>Add Schedule</button>
        </div>
      </div>

      {/* Due tasks */}
      <div className={`${colors.bgSecondary} rounded-lg p-6 ${colors.border} border`}>
        <h3 className={`text-xl font-semibold ${colors.text} mb-4 flex items-center gap-2`}><Clock size={20} /> Due Now</h3>
        {dueTasks.length === 0 ? (
          <div className={`text-center ${colors.textMuted} py-6`}>
            <CheckCircle size={40} className="mx-auto mb-2 text-green-500" />
            <p>All caught up! No feedings due.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dueTasks.map(({ schedule, status }) => (
              <div key={schedule.id} className={`flex items-center gap-3 p-3 rounded-lg ${status.overdue ? 'bg-red-900/10 border border-red-500/30' : 'bg-yellow-900/10 border border-yellow-500/30'}`}>
                <Droplets size={18} className="text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className={`font-medium ${colors.text}`}>Feed {schedule.plant_name}</div>
                  <div className={`text-sm ${colors.textMuted}`}>
                    {schedule.nutrient_type} · EC {schedule.ec_level} · {status.overdue ? `${Math.abs(status.daysUntil)}d overdue` : 'due today'}
                  </div>
                </div>
                {status.overdue && <AlertTriangle size={16} className="text-red-500" />}
                <button onClick={() => doMarkFed(schedule)} className={`${colors.primaryBg} text-white text-sm px-3 py-1.5 rounded-lg flex-shrink-0`}>Mark fed</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {plants.map((plant) => {
          const rec = recommendationFor(plant);
          return (
            <div key={plant.id} className={`${colors.bgSecondary} rounded-xl shadow-lg p-6 ${colors.border} border`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-xl font-semibold ${colors.text}`}>{plant.name}</h3>
                {rec && <span className={`text-sm font-medium ${colors.primary}`}>{stageLabel(rec.stage)}</span>}
              </div>
              {!rec || !rec.guidance ? (
                <p className={colors.textMuted}>Add a log to get recommendations.</p>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className={`${colors.bgAccent} rounded p-2`}>
                      <div className={`text-xs ${colors.textMuted}`}>Target EC</div>
                      <div className={`font-semibold ${colors.text}`}>{rec.guidance.ec ? `${rec.guidance.ec.min}–${rec.guidance.ec.max}` : '—'}</div>
                    </div>
                    <div className={`${colors.bgAccent} rounded p-2`}>
                      <div className={`text-xs ${colors.textMuted}`}>Target pH</div>
                      <div className={`font-semibold ${colors.text}`}>{rec.guidance.phRange ? `${rec.guidance.phRange.min}–${rec.guidance.phRange.max}` : '—'}</div>
                    </div>
                  </div>
                  {rec.guidance.feeding && (
                    <Rec colors={colors} icon={<Droplets size={16} className="text-blue-400" />} title="Feeding" text={rec.guidance.feeding.details} />
                  )}
                  {rec.guidance.care?.monitoring && (
                    <Rec colors={colors} icon={<Eye size={16} className="text-purple-400" />} title="Monitor" text={rec.guidance.care.monitoring} />
                  )}
                  <button onClick={() => setCalculatorStage(rec.stage)} className={`${colors.primaryBg} text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2`}>
                    <Calculator size={16} /> Calculate Nutrients
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Active schedules */}
      <div className={`${colors.bgSecondary} rounded-lg p-6 ${colors.border} border`}>
        <h3 className={`text-xl font-semibold ${colors.text} mb-4`}>Active Schedules</h3>
        {schedules.length === 0 ? (
          <div className={`text-center ${colors.textMuted} py-8`}>
            <Calendar size={40} className="mx-auto mb-2 opacity-50" />
            <p>No feeding schedules yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map((s) => (
              <div key={s.id} className={`${colors.bgAccent} rounded-lg p-4 flex items-center justify-between gap-3`}>
                <div className="min-w-0">
                  <div className={`font-medium ${colors.text}`}>{s.plant_name}</div>
                  <div className={`text-sm ${colors.textMuted}`}>{s.nutrient_type} · EC {s.ec_level} · {FREQUENCY_LABELS[s.frequency] || s.frequency}</div>
                  <div className={`text-xs ${colors.textMuted} mt-0.5`}>Last fed: {s.last_fed ? formatDate(s.last_fed) : 'Never'}</div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => doMarkFed(s)} className={`${colors.textMuted} hover:text-blue-500 p-2`} title="Mark fed"><Droplets size={18} /></button>
                  <button onClick={() => openEdit(s)} className={`${colors.textMuted} hover:${colors.primary} p-2`} title="Edit"><Pencil size={18} /></button>
                  <button onClick={() => doDelete(s)} className="text-red-500 hover:text-red-700 p-2" title="Delete"><Trash2 size={18} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / edit schedule modal */}
      {editing && (
        <Modal title={editing === 'new' ? 'Add Feeding Schedule' : 'Edit Schedule'} onClose={() => setEditing(null)}>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select value={form.plant_id} onChange={(e) => setForm({ ...form, plant_id: e.target.value })} className={inputCls} required>
                <option value="">Select plant…</option>
                {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input value={form.nutrient_type} onChange={(e) => setForm({ ...form, nutrient_type: e.target.value })} placeholder="Nutrient type" className={inputCls} required />
              <input type="number" step="0.1" value={form.ec_level} onChange={(e) => setForm({ ...form, ec_level: e.target.value })} placeholder="EC level" className={inputCls} />
              <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className={inputCls}>
                <option value="daily">Daily</option>
                <option value="every-2-days">Every 2 days</option>
                <option value="weekly">Weekly</option>
                <option value="custom">Custom</option>
              </select>
              {form.frequency === 'custom' && (
                <input type="number" min="1" value={form.custom_interval_days} onChange={(e) => setForm({ ...form, custom_interval_days: e.target.value })} placeholder="Every N days" className={inputCls} />
              )}
            </div>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes…" rows="2" className={`${inputCls} resize-none`} />
            <div className="flex gap-3">
              <button type="submit" disabled={busy} className={`flex-1 ${colors.primaryBg} text-white py-2 rounded-lg font-medium disabled:opacity-50`}>{busy ? 'Saving…' : 'Save'}</button>
              <button type="button" onClick={() => setEditing(null)} className={`px-4 py-2 ${colors.bgAccent} ${colors.text} rounded-lg border ${colors.border}`}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Calendar export modal */}
      {showCalendar && (
        <Modal title="Export Feeding Schedule to Calendar" onClose={() => setShowCalendar(false)} maxWidth="max-w-3xl">
          <FeedingScheduleCalendarExport />
        </Modal>
      )}

      {/* Nutrient calculator */}
      {calculatorStage !== null && (
        <NutrientCalculator plantStage={calculatorStage} onClose={() => setCalculatorStage(null)} />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete schedule"
          message={`Delete the feeding schedule for ${pendingDelete.plant_name}?`}
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
};

const Rec = ({ colors, icon, title, text }) => (
  <div className="flex gap-3">
    <div className="mt-1 flex-shrink-0">{icon}</div>
    <div>
      <div className={`font-medium ${colors.text} text-sm`}>{title}</div>
      <div className={`text-sm ${colors.textMuted}`}>{text}</div>
    </div>
  </div>
);

export default FeedingSchedule;
