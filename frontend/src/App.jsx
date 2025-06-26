// src/App.jsx
import { useEffect, useState } from 'react';
import api from './api/api';
import GrowthChart from './components/GrowthChart';
import GrowthForm from './components/AddLogForm';
import FeedingSchedule from './components/FeedingSchedule';
import ExportCSVButton from './components/ExportCSVButton';
import ThemeToggle from './components/ThemeToggle';
import Dashboard from './components/Dashboard';

function App() {
  const [logs, setLogs] = useState([]);
  const [chartData, setChartData] = useState([]);

  const fetchLogs = async () => {
    try {
      const res = await api.get('/logs');
      setLogs(res.data);

      const formatted = res.data.map((log) => ({
        date: new Date(log.created_at).toLocaleDateString(),
        height: parseFloat(log.height),
      }));
      setChartData(formatted.reverse());
    } catch (err) {
      console.error('API fetch error:', err);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  /* -----------------------------  JSX  ---------------------------- */

  return (
    <div className="min-h-screen bg-brandGray text-hydro-light dark:bg-brandGray-light flex flex-col items-center p-8">
      {/* Header bar -------------------------------------------------- */}
      <div className="w-full max-w-3xl flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-hydro">
          🌱 Hydroponic Growth Tracker
        </h1>
        <div className="flex items-center">
          <ExportCSVButton />
          <ThemeToggle />
        </div>
      </div>

      {/* Dashboard */}
      <div className="w-full max-w-5xl mb-10">
        <Dashboard logs={logs} />
      </div>

      {/* Optionally keep the old chart/form/logs below, or remove if you want only the dashboard */}
      {/* Growth Chart ------------------------------------------------ */}
      <div className="w-full max-w-3xl mb-6">
        <GrowthChart data={chartData} />
      </div>

      {/* Add Log Form ---------------------------------------------- */}
      <div className="w-full max-w-3xl mb-6">
        <GrowthForm refreshLogs={fetchLogs} />
      </div>

      {/* Logs list -------------------------------------------------- */}
      <ul className="w-full max-w-3xl space-y-2">
        {logs.length ? (
          logs.map((log) => (
            <li key={log.id} className="bg-brandGray-light p-4 rounded shadow">
              <p className="text-hydro">
                <strong>Plant:</strong> {log.plant_name}
              </p>
              <p><strong>Height:</strong> {log.height} cm</p>
              <p><strong>Nutrients:</strong> {log.nutrients}</p>
              <p><strong>Notes:</strong> {log.notes}</p>
            </li>
          ))
        ) : (
          <p>No logs yet.</p>
        )}
      </ul>

      <FeedingSchedule />
    </div>
  );
}

export default App;
