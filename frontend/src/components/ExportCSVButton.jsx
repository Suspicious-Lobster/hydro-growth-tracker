import React, { useState } from 'react';
import { Download, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import api from '../api/api';

const ExportCSVButton = () => {
  const { colors } = useTheme();
  const [status, setStatus] = useState('idle'); // idle | loading | success | error

  const handleExport = async () => {
    setStatus('loading');
    try {
      const res = await api.get('/logs/export', { responseType: 'blob' });

      // Build a blob URL & trigger download
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `hydro_logs_${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      setStatus('success');
      setTimeout(() => setStatus('idle'), 2500);
    } catch (err) {
      console.error('CSV export failed:', err);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  const label = {
    idle: 'Export CSV',
    loading: 'Exporting…',
    success: 'Exported!',
    error: 'Export failed',
  }[status];

  return (
    <button
      onClick={handleExport}
      disabled={status === 'loading'}
      className={`${colors.bgAccent} ${colors.text} border ${colors.border} px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:opacity-80 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed`}
      title="Export all logs to CSV"
    >
      {status === 'loading' && <Loader2 size={16} className="animate-spin" />}
      {status === 'success' && <Check size={16} className="text-green-500" />}
      {status === 'error' && <AlertCircle size={16} className="text-red-500" />}
      {status === 'idle' && <Download size={16} />}
      {label}
    </button>
  );
};

export default ExportCSVButton;
