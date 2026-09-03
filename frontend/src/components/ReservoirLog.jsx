import React, { useState } from 'react';
import { Droplets, Trash2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAppData } from '../contexts/AppDataContext';
import { useToast } from '../contexts/ToastContext';
import { apiErrorMessage } from '../api/api';
import ConfirmDialog from './ui/ConfirmDialog';
import { formatVolume, formatDate, toLiters, volumeUnitLabel } from '../utils/format';
import { todayLocalISO, parseLocalDate } from '../utils/dates';
import { emitSafe } from '../utils/budBus';
import { BUD_EVENTS } from '../data/budCues';

const KIND_LABELS = { change: 'Full change', topoff: 'Top-off' };

const emptyForm = (now) => ({ kind: 'change', volume: '', date: todayLocalISO(now), ec: '', ph: '', notes: '' });

// Whole days between a stored calendar-day date and `now`, floored, min 0.
function daysAgo(dateString, now) {
  const then = parseLocalDate(dateString);
  if (!then) return null;
  const diffMs = now.getTime() - then.getTime();
  const days = Math.floor(diffMs / 86400000);
  return days < 0 ? 0 : days;
}

const ReservoirLog = ({ plant, now = new Date() }) => {
  const { colors } = useTheme();
  const { settings, getPlantReservoirEvents, createReservoirEvent, deleteReservoirEvent } = useAppData();
  const toast = useToast();
  const volumeUnit = settings.units.volume;

  const [form, setForm] = useState(emptyForm(now));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const inputCls = `w-full px-3 py-2 ${colors.bgAccent} border ${colors.border} rounded-lg ${colors.text} focus:outline-none focus:ring-2 focus:ring-blue-500`;

  const events = getPlantReservoirEvents(plant);
  const lastChange = events.find((e) => e.kind === 'change');

  const submit = async (e) => {
    e.preventDefault();
    const parsedVolume = parseFloat(form.volume);
    if (!(parsedVolume > 0)) {
      setError('Enter a volume greater than 0');
      return;
    }
    setError('');
    setBusy(true);
    const payload = {
      plant_id: plant.id,
      date: form.date,
      kind: form.kind,
      volume: Math.round(toLiters(parsedVolume, volumeUnit) * 100) / 100,
    };
    if (form.ec !== '') payload.ec = parseFloat(form.ec);
    if (form.ph !== '') payload.ph = parseFloat(form.ph);
    if (form.notes.trim() !== '') payload.notes = form.notes.trim();
    try {
      await createReservoirEvent(payload);
      toast.success('Reservoir event added');
      emitSafe(BUD_EVENTS.SAVE_OK, { kind: 'reservoir' });
      setForm(emptyForm(now));
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to add reservoir event'));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteReservoirEvent(pendingDelete.id);
      toast.success('Event deleted');
      emitSafe(BUD_EVENTS.DELETE, { kind: 'reservoir' });
      setPendingDelete(null);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to delete event'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={`${colors.bgSecondary} rounded-xl shadow-lg p-5 ${colors.border} border`}>
      <h3 className={`text-lg font-semibold ${colors.text} mb-3 flex items-center gap-2`}>
        <Droplets size={18} /> Reservoir
      </h3>

      <p className={`text-sm ${colors.textMuted} mb-4`}>
        {lastChange
          ? `Last full change: ${daysAgo(lastChange.date, now)} days ago (${formatDate(lastChange.date)})`
          : 'Last full change: never logged'}
      </p>

      {events.length > 0 && (
        <div className="space-y-2 mb-4">
          {events.map((event) => (
            <div key={event.id} className={`${colors.bgAccent} rounded-lg p-3 text-sm ${colors.text} flex items-center justify-between gap-3`}>
              <div className="min-w-0">
                <div className="font-medium">{KIND_LABELS[event.kind] || event.kind}</div>
                <div className={colors.textMuted}>
                  {formatVolume(event.volume, volumeUnit)} · {formatDate(event.date)}
                  {(event.ec != null || event.ph != null) && (
                    <> · {event.ec != null ? `EC ${event.ec}` : ''}{event.ec != null && event.ph != null ? ' / ' : ''}{event.ph != null ? `pH ${event.ph}` : ''}</>
                  )}
                </div>
                {event.notes && <div className={colors.textMuted}>{event.notes}</div>}
              </div>
              <button
                onClick={() => setPendingDelete(event)}
                className="text-red-500 hover:text-red-700 p-2 flex-shrink-0"
                aria-label="Delete event"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select
            aria-label="Event type"
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value })}
            className={inputCls}
          >
            <option value="change">Full change</option>
            <option value="topoff">Top-off</option>
          </select>
          <input
            aria-label="Volume"
            type="number"
            step="0.01"
            min="0"
            placeholder={`Volume (${volumeUnitLabel(volumeUnit)})`}
            value={form.volume}
            onChange={(e) => setForm({ ...form, volume: e.target.value })}
            className={inputCls}
          />
          <input
            aria-label="Event date"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className={inputCls}
          />
          <input
            aria-label="EC"
            type="number"
            step="0.1"
            placeholder="EC"
            value={form.ec}
            onChange={(e) => setForm({ ...form, ec: e.target.value })}
            className={inputCls}
          />
          <input
            aria-label="pH"
            type="number"
            step="0.1"
            placeholder="pH"
            value={form.ph}
            onChange={(e) => setForm({ ...form, ph: e.target.value })}
            className={inputCls}
          />
          <input
            aria-label="Notes"
            type="text"
            placeholder="Notes…"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className={inputCls}
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={busy} className={`${colors.primaryBg} text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50`}>
          {busy ? 'Adding…' : 'Add event'}
        </button>
      </form>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete event"
          message="Delete this reservoir event?"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
};

export default ReservoirLog;
