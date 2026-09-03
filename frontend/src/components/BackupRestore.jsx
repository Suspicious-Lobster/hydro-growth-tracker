import React, { useRef, useState } from 'react';
import { Download, Upload, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAppData } from '../contexts/AppDataContext';
import { useToast } from '../contexts/ToastContext';
import api, { apiErrorMessage } from '../api/api';
import { downloadBlob } from '../utils/download';
import Modal from './ui/Modal';

const BACKUP_TYPE = 'hydro-growth-tracker-backup';

// Pull the inner data object out of either our export envelope or a bare dump,
// and summarize how many records it holds for the confirmation preview.
const summarize = (parsed) => {
  const raw = parsed && parsed._type === BACKUP_TYPE ? parsed.data : parsed;
  const len = (v) => (Array.isArray(v) ? v.length : 0);
  return { plants: len(raw?.plants), logs: len(raw?.logs), schedules: len(raw?.schedules) };
};

const todayStamp = () => new Date().toISOString().slice(0, 10);

// Back up the full data store to a JSON file, or restore (replace) it from one.
// The zip variant (MR-54) bundles the same JSON plus the photo files under
// uploads/. Restore is destructive, so both go through an explicit
// confirmation modal.
const BackupRestore = () => {
  const { colors } = useTheme();
  const { refresh } = useAppData();
  const toast = useToast();

  const fileRef = useRef(null);
  const zipRef = useRef(null);
  const csvRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [restoring, setRestoring] = useState(false);
  // { kind: 'json', parsed, counts, filename } | { kind: 'zip', file, filename }
  const [pending, setPending] = useState(null);
  // CSV import (MR-55): { csv, filename, summary } after the server's dry run.
  const [pendingImport, setPendingImport] = useState(null);
  const [importing, setImporting] = useState(false);

  // Read the CSV locally, ask the server for a dry run (nothing is written),
  // and stage the summary for confirmation.
  const handleCsvFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    try {
      const csv = await file.text();
      const res = await api.post('/logs/import', { csv, dryRun: true });
      setPendingImport({ csv, filename: file.name, summary: res.data });
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not read that CSV'));
    } finally {
      setImporting(false);
    }
  };

  const confirmImport = async () => {
    setImporting(true);
    try {
      const res = await api.post('/logs/import', { csv: pendingImport.csv, dryRun: false });
      await refresh();
      const c = res.data?.created;
      toast.success(c ? `Imported ${c.logs} logs${c.plants ? ` and ${c.plants} new plants` : ''}` : 'Logs imported');
      setPendingImport(null);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to import logs'));
    } finally {
      setImporting(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await api.get('/backup', { responseType: 'blob' });
      downloadBlob(`hydro_backup_${todayStamp()}.json`, new Blob([res.data], { type: 'application/json' }));
      toast.success('Backup downloaded');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to create backup'));
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadZip = async () => {
    setDownloadingZip(true);
    try {
      const res = await api.get('/backup/zip', { responseType: 'blob' });
      downloadBlob(`hydro_backup_${todayStamp()}.zip`, new Blob([res.data], { type: 'application/zip' }));
      toast.success('Backup with photos downloaded');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to create backup'));
    } finally {
      setDownloadingZip(false);
    }
  };

  // Read + parse the chosen file locally so a bad file is caught before we touch
  // the store, then stage it for confirmation.
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file later
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      setPending({ kind: 'json', parsed, counts: summarize(parsed), filename: file.name });
    } catch {
      toast.error('That file is not valid JSON.');
    }
  };

  // A zip cannot be inspected in the renderer; the server validates every
  // entry before it replaces anything, so staging just names the file.
  const handleZipFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPending({ kind: 'zip', file, filename: file.name });
  };

  const confirmRestore = async () => {
    setRestoring(true);
    try {
      let res;
      if (pending.kind === 'zip') {
        const fd = new FormData();
        fd.append('archive', pending.file, pending.filename);
        res = await api.post('/backup/restore/zip', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        res = await api.post('/backup/restore', pending.parsed);
      }
      await refresh();
      const c = res.data?.counts;
      toast.success(c
        ? `Restored ${c.plants} plants, ${c.logs} logs, ${c.schedules} schedules${c.photos != null ? `, ${c.photos} photos` : ''}`
        : 'Backup restored');
      setPending(null);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to restore backup'));
    } finally {
      setRestoring(false);
    }
  };

  const btn = `${colors.bgAccent} ${colors.text} border ${colors.border} px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50`;

  return (
    <div className={`${colors.bgSecondary} rounded-xl shadow-lg p-6 ${colors.border} border space-y-4`}>
      <div>
        <h2 className={`text-2xl font-bold ${colors.primary}`}>💾 Backup &amp; Restore</h2>
        <p className={colors.textMuted}>
          Save all your plants, logs, feeding schedules, and settings to a file, or restore them from one.
          The JSON backup is data only; the zip backup also includes your photos.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={handleDownload} disabled={downloading} className={btn}>
          <Download size={16} /> {downloading ? 'Preparing…' : 'Download backup'}
        </button>
        <button onClick={handleDownloadZip} disabled={downloadingZip} className={btn}>
          <ImageIcon size={16} /> {downloadingZip ? 'Preparing…' : 'Download backup with photos'}
        </button>
        <button onClick={() => fileRef.current?.click()} className={btn}>
          <Upload size={16} /> Restore from backup…
        </button>
        <button onClick={() => zipRef.current?.click()} className={btn}>
          <Upload size={16} /> Restore from zip…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFile}
          className="hidden"
          aria-hidden="true"
        />
        <input
          ref={zipRef}
          type="file"
          accept="application/zip,.zip"
          onChange={handleZipFile}
          className="hidden"
          aria-hidden="true"
          data-testid="zip-input"
        />
      </div>

      <div className="space-y-2">
        <p className={`text-sm ${colors.textMuted}`}>
          Bring in logs from a spreadsheet or another tracker: a CSV with at least plant, date and height columns
          (this app&apos;s own export works as-is). You get a preview before anything is added.
        </p>
        <button onClick={() => csvRef.current?.click()} disabled={importing} className={btn}>
          <Upload size={16} /> {importing && !pendingImport ? 'Checking…' : 'Import logs from CSV…'}
        </button>
        <input
          ref={csvRef}
          type="file"
          accept="text/csv,.csv"
          onChange={handleCsvFile}
          className="hidden"
          aria-hidden="true"
          data-testid="csv-input"
        />
      </div>

      {pendingImport && (
        <Modal title="Import these logs?" onClose={() => !importing && setPendingImport(null)} maxWidth="max-w-lg">
          <div className="space-y-4">
            <div className={`text-sm ${colors.text}`}>
              <span className="font-mono">{pendingImport.filename}</span> holds {pendingImport.summary.rows} rows:{' '}
              <strong>{pendingImport.summary.valid} valid</strong>, {pendingImport.summary.errors.length} with problems.
              {pendingImport.summary.newPlants?.length > 0 && (
                <> New plants will be created: {pendingImport.summary.newPlants.join(', ')}.</>
              )}
            </div>
            {pendingImport.summary.errors.length > 0 && (
              <div className={`p-3 rounded-lg ${colors.bgAccent} border ${colors.border} text-sm space-y-1`}>
                <div className={`flex items-center gap-2 ${colors.text} font-medium`}>
                  <AlertTriangle size={16} className="text-amber-500" /> Fix these rows in the file, then try again
                </div>
                <ul className={`${colors.textMuted} list-disc pl-5`}>
                  {pendingImport.summary.errors.slice(0, 5).map((e) => (
                    <li key={e.line}>Line {e.line}: {e.messages.join('; ')}</li>
                  ))}
                  {pendingImport.summary.errors.length > 5 && <li>…and {pendingImport.summary.errors.length - 5} more</li>}
                </ul>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setPendingImport(null)} disabled={importing} className={btn}>
                Cancel
              </button>
              <button
                onClick={confirmImport}
                disabled={importing || pendingImport.summary.errors.length > 0 || pendingImport.summary.valid === 0}
                className={`${colors.primaryBg} text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50`}
              >
                {importing ? 'Importing…' : `Import ${pendingImport.summary.valid} logs`}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {pending && (
        <Modal title="Restore from backup?" onClose={() => !restoring && setPending(null)} maxWidth="max-w-lg">
          <div className="space-y-4">
            <div className={`flex items-start gap-3 p-3 rounded-lg ${colors.bgAccent} border ${colors.border}`}>
              <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className={`text-sm ${colors.text}`}>
                This replaces <strong>all</strong> current data with the contents of{' '}
                <span className="font-mono">{pending.filename}</span>. Your current plants, logs, and
                schedules will be overwritten. This can&apos;t be undone.
              </p>
            </div>
            <div className={`text-sm ${colors.textMuted}`}>
              {pending.kind === 'zip'
                ? 'The app checks every file in the zip before anything is replaced; photos in the zip are added to your library.'
                : `The backup contains ${pending.counts.plants} plants, ${pending.counts.logs} logs, and ${pending.counts.schedules} feeding schedules.`}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPending(null)} disabled={restoring} className={btn}>
                Cancel
              </button>
              <button
                onClick={confirmRestore}
                disabled={restoring}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
              >
                {restoring ? 'Restoring…' : 'Replace all data'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default BackupRestore;
