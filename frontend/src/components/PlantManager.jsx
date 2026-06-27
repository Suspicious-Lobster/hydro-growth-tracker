import React, { useState } from 'react';
import { Plus, Trash2, Pencil, Archive, ArchiveRestore, AlertTriangle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAppData } from '../contexts/AppDataContext';
import { useToast } from '../contexts/ToastContext';
import api, { apiErrorMessage } from '../api/api';
import Modal from './ui/Modal';
import { SPECIES_OPTIONS, getProfileStages, stageLabel } from '../data/recommendations';
import { currentHeight, totalGrowth, daysTracked } from '../utils/stats';
import { formatLength, formatVolume, toLiters, fromLiters } from '../utils/format';
import { GROWTH_STAGES } from '../data/plantKnowledge';

const SYSTEM_TYPES = ['DWC', 'NFT', 'Ebb & Flow', 'Drip', 'Aeroponics', 'Kratky', 'Wick'];
const emptyPlant = () => ({ name: '', species: '', variety: '', system_type: '', reservoir_volume: '', start_date: '', target_stage: '' });

const PlantManager = ({ onSelectPlant }) => {
  const { colors } = useTheme();
  const { plants, settings, getPlantLogs, createPlant, updatePlant, archivePlant, deletePlant } = useAppData();
  const toast = useToast();

  const [editing, setEditing] = useState(null); // null | 'new' | plant object
  const [form, setForm] = useState(emptyPlant);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const { length: lengthUnit, volume: volumeUnit } = settings.units;
  const visible = plants; // context returns active plants; archived fetched on demand below
  const [archived, setArchived] = useState([]);

  const openNew = () => { setForm(emptyPlant()); setEditing('new'); };
  const openEdit = (plant) => {
    setForm({
      name: plant.name,
      species: plant.species || '',
      variety: plant.variety || '',
      system_type: plant.system_type || '',
      // Stored canonically in liters; show in the active display unit.
      reservoir_volume: plant.reservoir_volume == null ? '' : Math.round(fromLiters(parseFloat(plant.reservoir_volume), volumeUnit) * 100) / 100,
      start_date: plant.start_date || '',
      target_stage: plant.target_stage || '',
    });
    setEditing(plant);
  };

  const payloadFromForm = () => ({
    name: form.name.trim(),
    species: form.species || null,
    variety: form.variety || null,
    system_type: form.system_type || null,
    // Convert the display-unit input back to canonical liters for storage.
    reservoir_volume: form.reservoir_volume === '' ? null : toLiters(parseFloat(form.reservoir_volume), volumeUnit),
    start_date: form.start_date || null,
    target_stage: form.target_stage || null,
  });

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Plant name is required'); return; }
    setBusy(true);
    try {
      if (editing === 'new') {
        await createPlant(payloadFromForm());
        toast.success(`Added "${form.name.trim()}"`);
      } else {
        await updatePlant(editing.id, payloadFromForm());
        toast.success('Plant updated');
      }
      setEditing(null);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to save plant'));
    } finally {
      setBusy(false);
    }
  };

  const doArchive = async (plant) => {
    try { await archivePlant(plant.id); toast.success(`Archived "${plant.name}"`); }
    catch (err) { toast.error(apiErrorMessage(err)); }
  };

  const doRestore = async (plant) => {
    try { await updatePlant(plant.id, { name: plant.name, archived: false }); toast.success(`Restored "${plant.name}"`); await loadArchived(); }
    catch (err) { toast.error(apiErrorMessage(err)); }
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await deletePlant(confirmDelete.id);
      toast.success(`Deleted "${confirmDelete.name}"`);
      setConfirmDelete(null);
      await loadArchived();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to delete plant'));
    } finally {
      setBusy(false);
    }
  };

  // Lazy-load archived plants when the toggle is switched on.
  const loadArchived = async () => {
    try {
      const res = await api.get('/plants?archived=true');
      setArchived((res.data || []).filter((p) => p.archived));
    } catch { /* ignore */ }
  };

  const toggleArchived = async () => {
    const next = !showArchived;
    setShowArchived(next);
    if (next) await loadArchived();
  };

  const stageOptions = form.species ? getProfileStages(form.species) : Object.values(GROWTH_STAGES);
  const inputCls = `w-full px-3 py-2 ${colors.bgAccent} border ${colors.border} rounded-lg ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-3xl font-bold ${colors.primary}`}>🌱 Plant Management</h2>
          <p className={colors.textMuted}>Create, rename, archive, or delete plants.</p>
        </div>
        <button onClick={openNew} className={`${colors.primaryBg} text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2`}>
          <Plus size={18} /> Add Plant
        </button>
      </div>

      {/* Active plants */}
      <div className={`${colors.bgSecondary} rounded-lg p-6 ${colors.border} border`}>
        <h3 className={`text-xl font-semibold ${colors.text} mb-4`}>Current Plants ({visible.length})</h3>
        {visible.length === 0 ? (
          <div className={`text-center ${colors.textMuted} py-8`}>
            <div className="text-6xl mb-4">🌱</div>
            <p>No plants yet. Add your first plant to get started!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((plant) => {
              const logs = getPlantLogs(plant);
              return (
                <div key={plant.id} className={`${colors.bgAccent} rounded-lg p-4 flex items-center justify-between ${colors.border} border`}>
                  <button className="flex-1 text-left" onClick={() => onSelectPlant?.(plant.id)}>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full" />
                      <div>
                        <h4 className={`font-semibold ${colors.text}`}>{plant.name}</h4>
                        <div className={`text-sm ${colors.textMuted} flex flex-wrap gap-x-4`}>
                          <span>{plant.species || 'Unspecified'}</span>
                          <span>{logs.length} logs</span>
                          {logs.length > 0 && <span>{formatLength(currentHeight(logs), lengthUnit)}</span>}
                          {logs.length > 1 && <span>+{formatLength(totalGrowth(logs), lengthUnit)} · {daysTracked(logs)}d</span>}
                          {plant.reservoir_volume != null && <span>{formatVolume(plant.reservoir_volume, volumeUnit)}</span>}
                        </div>
                      </div>
                    </div>
                  </button>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(plant)} className={`${colors.textMuted} hover:${colors.primary} p-2`} title="Edit"><Pencil size={18} /></button>
                    <button onClick={() => doArchive(plant)} className={`${colors.textMuted} hover:text-yellow-500 p-2`} title="Archive"><Archive size={18} /></button>
                    <button onClick={() => setConfirmDelete(plant)} className="text-red-500 hover:text-red-700 p-2" title="Delete"><Trash2 size={18} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Archived */}
      <div>
        <button onClick={toggleArchived} className={`text-sm ${colors.textMuted} underline`}>
          {showArchived ? 'Hide archived' : 'Show archived'}
        </button>
        {showArchived && (
          <div className={`${colors.bgSecondary} rounded-lg p-4 mt-2 ${colors.border} border space-y-2`}>
            {archived.length === 0 ? (
              <p className={colors.textMuted}>No archived plants.</p>
            ) : archived.map((plant) => (
              <div key={plant.id} className={`${colors.bgAccent} rounded-lg p-3 flex items-center justify-between`}>
                <span className={colors.text}>{plant.name}</span>
                <div className="flex gap-1">
                  <button onClick={() => doRestore(plant)} className={`${colors.textMuted} hover:text-green-500 p-2`} title="Restore"><ArchiveRestore size={18} /></button>
                  <button onClick={() => setConfirmDelete(plant)} className="text-red-500 hover:text-red-700 p-2" title="Delete"><Trash2 size={18} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / edit modal */}
      {editing && (
        <Modal title={editing === 'new' ? 'Add Plant' : `Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <form onSubmit={save} className="space-y-4">
            <Field label="Name" colors={colors}>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="e.g., Tomato Plant #1" autoFocus />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Species" colors={colors}>
                <select value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value })} className={inputCls}>
                  <option value="">Unspecified</option>
                  {SPECIES_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Variety" colors={colors}>
                <input value={form.variety} onChange={(e) => setForm({ ...form, variety: e.target.value })} className={inputCls} placeholder="e.g., Sungold" />
              </Field>
              <Field label="System type" colors={colors}>
                <select value={form.system_type} onChange={(e) => setForm({ ...form, system_type: e.target.value })} className={inputCls}>
                  <option value="">Unspecified</option>
                  {SYSTEM_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label={`Reservoir (${volumeUnit === 'gallons' ? 'gal' : 'L'})`} colors={colors}>
                <input type="number" step="1" value={form.reservoir_volume} onChange={(e) => setForm({ ...form, reservoir_volume: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Start date" colors={colors}>
                <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={inputCls} />
              </Field>
              <Field label="Target stage" colors={colors}>
                <select value={form.target_stage} onChange={(e) => setForm({ ...form, target_stage: e.target.value })} className={inputCls}>
                  <option value="">None</option>
                  {stageOptions.map((s) => <option key={s} value={s}>{stageLabel(s)}</option>)}
                </select>
              </Field>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={busy} className={`flex-1 ${colors.primaryBg} text-white py-2 rounded-lg font-medium disabled:opacity-50`}>
                {busy ? 'Saving…' : (editing === 'new' ? 'Add Plant' : 'Save Changes')}
              </button>
              <button type="button" onClick={() => setEditing(null)} className={`px-4 py-2 ${colors.bgAccent} ${colors.text} rounded-lg border ${colors.border}`}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <Modal title="Delete Plant" onClose={() => setConfirmDelete(null)} maxWidth="max-w-md">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle size={24} className="text-red-500" />
            <p className={colors.text}>Permanently delete <strong>{confirmDelete.name}</strong> and all its logs and schedules? This cannot be undone.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={doDelete} disabled={busy} className="flex-1 bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50">
              {busy ? 'Deleting…' : 'Delete Permanently'}
            </button>
            <button onClick={() => setConfirmDelete(null)} className={`px-4 py-2 ${colors.bgAccent} ${colors.text} rounded-lg border ${colors.border}`}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
};

const Field = ({ label, colors, children }) => (
  <div>
    <label className={`block text-sm font-medium ${colors.text} mb-1`}>{label}</label>
    {children}
  </div>
);

export default PlantManager;
