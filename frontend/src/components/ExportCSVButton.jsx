import React, { useState } from 'react';
import { Download } from 'lucide-react';
import api from '../api/api';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';

const ExportCSVButton = () => {
  const { colors } = useTheme();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setBusy(true);
    try {
      const res = await api.get('/logs/export', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `hydro_logs_${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Logs exported to CSV');
    } catch {
      toast.error('Failed to export logs');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={busy}
      className={`${colors.bgAccent} ${colors.text} border ${colors.border} px-3 py-2 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity flex items-center gap-2 disabled:opacity-50`}
    >
      <Download size={16} />
      {busy ? 'Exporting…' : 'Export CSV'}
    </button>
  );
};

export default ExportCSVButton;
