import api from '../api/api';

const ExportCSVButton = () => {
  const handleExport = async () => {
    const res = await api.get('/logs/export', { responseType: 'blob' });

    // Build a blob URL & trigger download
    const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `hydro_logs_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      className="bg-hydro-light hover:bg-hydro px-3 py-2 rounded text-brandGray text-sm font-semibold shadow"
    >
      Export logs to CSV
    </button>
  );
};

export default ExportCSVButton;
